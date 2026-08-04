import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import type {
  BapmTarget,
  ConfigureMcpReport,
  MaterializeReport,
  TargetRegistry,
} from "bapm-target-api";
import { getConfigureMcp } from "bapm-target-api";
import {
  loadManifest,
  type BapmManifest,
  type DependencyEntry,
  type ObjectDependency,
} from "@/modules/Manifest";
import { loadLockfileOrNull, writeLockfile, type LockfileDocument } from "@/modules/Lockfile";
import {
  APM_MODULES_DIR,
  DEFAULT_PARALLEL_DOWNLOADS,
  downloadPackages,
  materializeRegistryNodes,
  resolveAndLock,
  resolveDependencyGraph,
  type ResolvedNode,
} from "@/modules/Resolver";
import { assertPolicyGateAllows, type PolicyCandidate } from "@/modules/Policy";
import {
  discoverPrimitives,
  resolvePrimitiveConflicts,
  type AttributedPrimitive,
} from "@/modules/Primitives";
import { extractPackArchive } from "@/modules/Pack";
import { evaluateExecutableTrust, parseExecutableGrants } from "@/modules/ExecutableTrust";
import { applyMcpInventoryToLock, collectMcpServers } from "@/modules/Mcp";
import {
  applyDeployedHashesToLock,
  cleanupOrphanDeployedFiles,
  collectDeployedHashes,
  verifyDeployedFileHashes,
} from "./deployedInventory.ts";
import { InstallError } from "./errors.ts";
import { enforceFrozen } from "./frozen.ts";
import { declaredTargetIds } from "./targets.ts";
import type { InstallResult, RunInstallOptions } from "./types.ts";

/**
 * Run install: optional archive extract → frozen gate → plan → policy gate →
 * download → orphan cleanup → primitives → targets → MCP trust/configure →
 * write deployed_file_hashes / mcp_* lock fields.
 */
export async function runInstall(options: RunInstallOptions = {}): Promise<InstallResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const frozen = options.frozen === true;
  const updateRefs = options.updateRefs === true || options.update === true;
  const forcedTargetId = options.forcedTarget ?? options.forceTarget;
  const policyPath = options.policyPath ?? options.policy;
  const noPolicy = options.noPolicy === true;
  const trustTransitiveMcp = options.trustTransitiveMcp === true;

  if (options.archivePath) {
    await extractArchiveIntoProject(options.archivePath, cwd);
  }

  if (frozen) {
    enforceFrozen({ cwd, updateRefs, update: options.update });
  }

  const { document: rootManifest } = loadManifest({ cwd });
  const previousLock = loadLockfileOrNull({ cwd });

  const registry = (options.targetRegistry ?? options.registry) as TargetRegistry | undefined;
  assertForcedTargetRegistered(forcedTargetId, registry);

  let lockPath: string | undefined;
  let nodes: ResolvedNode[] = [];
  let lockDocument: LockfileDocument | undefined;
  let policyDiagnostics: unknown[] = [];

  const ports = {
    gitRemote: options.gitRemote,
    tagLister: options.tagLister,
    downloader: options.downloader,
    experimentalRegistries: options.experimentalRegistries,
    registryBaseUrl: options.registryBaseUrl,
    mirrorUrl: options.mirrorUrl,
  };

  if (frozen) {
    const loaded = previousLock;
    const graph = await resolveDependencyGraph({
      cwd,
      updateRefs: false,
      maxDepth: options.maxDepth,
      existingLock: loaded?.document ?? null,
      skipDownload: true,
      ...ports,
    });
    nodes = graph.nodes;
    policyDiagnostics = applyPolicyGate({
      cwd,
      policyPath,
      noPolicy,
      nodes,
    });
    const packages = nodes
      .filter((n) => n.kind === "git-literal" || n.kind === "git-semver" || n.kind === "local")
      .map((n) => ({
        repoUrl: n.kind === "local" ? undefined : restoreGitUrl(n.repo_url),
        path: n.path,
        commit: n.resolved_commit,
        identity: n.identity,
        name: n.name,
      }));
    await downloadPackages({
      cwd,
      packages,
      parallelDownloads: options.parallelDownloads ?? DEFAULT_PARALLEL_DOWNLOADS,
      downloader: options.downloader,
    });
    await materializeRegistryNodes(nodes, {
      cwd,
      mirrorUrl: options.mirrorUrl,
      registryBaseUrl: options.registryBaseUrl,
    });
    lockPath = loaded?.sourcePath;
    lockDocument = loaded?.document;

    // lk-017 lite: re-verify deployed_file_hashes when present (before harness mutation)
    if (lockDocument) {
      verifyDeployedFileHashes({ cwd, document: lockDocument });
    }
  } else {
    const result = await resolveAndLock({
      cwd,
      updateRefs,
      parallelDownloads: options.parallelDownloads,
      maxDepth: options.maxDepth,
      verbose: options.verbose,
      policyPath,
      policy: policyPath,
      noPolicy,
      ...ports,
    });
    lockPath = result.lockPath;
    nodes = result.nodes;
    policyDiagnostics = result.policyDiagnostics ?? [];
    const reloaded = loadLockfileOrNull({ cwd });
    lockDocument = reloaded?.document;
    if (reloaded) {
      lockPath = reloaded.sourcePath;
    }
  }

  const currentDepNames = new Set(nodes.map((n) => n.name).filter(Boolean));

  if (!frozen) {
    cleanupOrphanDeployedFiles({
      cwd,
      previous: previousLock?.document,
      currentDepNames,
    });
  }

  const declarationOrder =
    nodes.length > 0
      ? uniqueNames(nodes.filter((n) => n.depth === 1).map((n) => n.name))
      : extractDeclarationOrder(rootManifest);

  const raw = discoverPrimitives({
    cwd,
    modulesDir: join(cwd, APM_MODULES_DIR),
    declarationOrder,
  });
  const resolved = resolvePrimitiveConflicts({
    primitives: raw,
    declarationOrder,
  });

  const activeTargets = await resolveActiveTargets({
    cwd,
    rootManifest,
    registry,
    override: options.activeTargets,
    forcedTargetId,
  });

  const allDeployed: ReturnType<typeof collectDeployedHashes> = [];
  const materializedPrimitives: AttributedPrimitive[] = [];

  if (registry && activeTargets.length > 0) {
    const packageTargets = collectPackageDeclaredTargets(nodes, raw);
    for (const targetId of activeTargets) {
      const target = findTarget(registry, targetId);
      if (!target) continue;

      const isForced = Boolean(forcedTargetId && forcedTargetId === targetId);
      const detected = isForced ? true : await target.detect({ cwd });
      if (!detected) continue;

      const filtered = filterByIntersection(
        resolved.primitives,
        targetId,
        packageTargets,
        rootManifest,
      );
      materializedPrimitives.push(...filtered);
      const report = (await target.materialize(filtered, {
        cwd,
        targetId,
        deployRoots: [...target.deployRoots],
      })) as void | MaterializeReport;
      allDeployed.push(...collectDeployedHashes(cwd, report));
    }
  }

  if (!frozen && lockDocument && allDeployed.length > 0) {
    const wrote = applyDeployedHashesToLock({
      document: lockDocument,
      deployed: allDeployed,
      primitives: materializedPrimitives.length > 0 ? materializedPrimitives : resolved.primitives,
    });
    if (wrote) {
      lockPath = writeLockfile(lockDocument, {
        cwd,
        sourcePath: lockPath,
        sourceFilename: previousLock?.sourceFilename,
      });
    }
  }

  const mcpDiagnostics: unknown[] = [];
  const mcpResult = await deployMcpAfterPolicy({
    cwd,
    rootManifest,
    nodes,
    registry,
    activeTargets,
    forcedTargetId,
    trustTransitiveMcp,
    frozen,
    lockDocument,
    lockPath,
    previousLockFilename: previousLock?.sourceFilename,
    diagnostics: mcpDiagnostics,
  });
  if (mcpResult.lockPath) lockPath = mcpResult.lockPath;
  if (mcpResult.lockDocument) lockDocument = mcpResult.lockDocument;

  if (mcpResult.withholdFatal) {
    throw new InstallError(
      "INSTALL_MCP_TRUST",
      mcpResult.withholdMessage ??
        "MCP withheld: unapproved dependency executables (sc-009 fail-closed)",
      { details: { withheld: mcpResult.withheldPackages } },
    );
  }

  return {
    ok: true,
    lockPath,
    modulesDir: join(cwd, APM_MODULES_DIR),
    activeTargets,
    primitivesCount: resolved.primitives.length,
    diagnostics: [...policyDiagnostics, ...resolved.diagnostics, ...mcpDiagnostics],
    policyDiagnostics,
  };
}

async function deployMcpAfterPolicy(args: {
  cwd: string;
  rootManifest: BapmManifest;
  nodes: ResolvedNode[];
  registry?: TargetRegistry;
  activeTargets: string[];
  forcedTargetId?: string;
  trustTransitiveMcp: boolean;
  frozen: boolean;
  lockDocument?: LockfileDocument;
  lockPath?: string;
  previousLockFilename?: string;
  diagnostics: unknown[];
}): Promise<{
  lockPath?: string;
  lockDocument?: LockfileDocument;
  withholdFatal: boolean;
  withholdMessage?: string;
  withheldPackages: string[];
}> {
  const grantSurface = parseExecutableGrants({
    manifest: args.rootManifest as Record<string, unknown>,
  });
  const collected = collectMcpServers({
    cwd: args.cwd,
    rootManifest: args.rootManifest,
    nodes: args.nodes,
    trustTransitiveMcp: args.trustTransitiveMcp,
    grantSurface,
  });

  if (collected.servers.length === 0) {
    return {
      lockPath: args.lockPath,
      lockDocument: args.lockDocument,
      withholdFatal: false,
      withheldPackages: [],
    };
  }

  const approved: typeof collected.servers = [];
  const withheldPackages: string[] = [];
  const rootName = String(args.rootManifest.name ?? "root");

  for (const server of collected.servers) {
    if (server.origin === "direct" || server.packageName === rootName) {
      approved.push(server);
      continue;
    }
    const decision = evaluateExecutableTrust({
      grantSurface,
      packageName: server.packageName,
      executableType: "mcp",
    });
    if (decision.outcome === "skip") {
      // No grant surface: only reach here for dep MCP when trust-transitive is on.
      approved.push(server);
      continue;
    }
    if (decision.allowed) {
      approved.push(server);
      continue;
    }
    withheldPackages.push(server.packageName);
    args.diagnostics.push({
      code: "MCP_TRUST_WITHHOLD",
      message: decision.reason ?? `unapproved MCP from "${server.packageName}" withheld`,
      packageName: server.packageName,
      server: server.name,
      withhold: true,
      unapproved: true,
    });
  }

  const uniqueWithheld = [...new Set(withheldPackages)];
  const withholdFatal = grantSurface.present && uniqueWithheld.length > 0;
  const withholdMessage = withholdFatal
    ? `MCP withheld: unapproved dependency executables (${uniqueWithheld.join(", ")}). Add to executables.allow / allowExecutables or remove MCP.`
    : undefined;

  if (approved.length === 0) {
    return {
      lockPath: args.lockPath,
      lockDocument: args.lockDocument,
      withholdFatal,
      withholdMessage,
      withheldPackages: uniqueWithheld,
    };
  }

  if (!args.registry || args.activeTargets.length === 0) {
    return {
      lockPath: args.lockPath,
      lockDocument: args.lockDocument,
      withholdFatal,
      withholdMessage,
      withheldPackages: uniqueWithheld,
    };
  }

  let wroteConfig = false;
  let configPath: string | undefined;
  let configuredTargetId: string | undefined;
  const configuredServers = approved;

  for (const targetId of args.activeTargets) {
    const target = findTarget(args.registry, targetId);
    if (!target) continue;

    const isForced = Boolean(args.forcedTargetId && args.forcedTargetId === targetId);
    const detected = isForced ? true : await target.detect({ cwd: args.cwd });
    if (!detected) continue;

    const configureMcp = getConfigureMcp(target);
    if (!configureMcp) continue;

    const report = (await configureMcp(configuredServers, {
      cwd: args.cwd,
      targetId,
      deployRoots: [...target.deployRoots],
    })) as void | ConfigureMcpReport;

    wroteConfig = true;
    configuredTargetId = targetId;
    configPath =
      report && typeof report === "object" && typeof report.configPath === "string"
        ? report.configPath
        : ".cursor/mcp.json";
    break;
  }

  let lockDocument = args.lockDocument;
  let lockPath = args.lockPath;

  if (wroteConfig && !args.frozen && lockDocument) {
    applyMcpInventoryToLock({
      document: lockDocument,
      servers: configuredServers,
      configPath,
      targetId: configuredTargetId,
    });
    lockPath = writeLockfile(lockDocument, {
      cwd: args.cwd,
      sourcePath: lockPath,
      sourceFilename: args.previousLockFilename,
    });
  }

  return {
    lockPath,
    lockDocument,
    withholdFatal,
    withholdMessage,
    withheldPackages: uniqueWithheld,
  };
}

/** Alias preferred by design docs. */
export const installProject = runInstall;

function applyPolicyGate(args: {
  cwd: string;
  policyPath?: string;
  noPolicy: boolean;
  nodes: ResolvedNode[];
}): unknown[] {
  const candidates = nodesToCandidates(args.nodes);
  const gate = assertPolicyGateAllows({
    cwd: args.cwd,
    policyPath: args.policyPath,
    policy: args.policyPath,
    noPolicy: args.noPolicy,
    candidates,
    dependencies: candidates.map((c) => ({
      name: c.id,
      id: c.id,
      ref: c.ref,
      constraint: c.constraint,
      direct: c.direct,
      depth: c.depth,
      path: c.path,
      source: c.source,
    })),
    graphDepth: args.nodes.reduce((m, n) => Math.max(m, n.depth ?? 0), 0),
    maxDepthObserved: args.nodes.reduce((m, n) => Math.max(m, n.depth ?? 0), 0),
  });
  const out: unknown[] = [...gate.diagnostics];
  if (gate.result?.outcome === "warn") {
    for (const v of gate.result.findings ?? gate.result.violations) {
      out.push({
        code: "POLICY_WARN",
        message: v.message,
        policy: true,
        enforcement: "warn",
      });
    }
  }
  return out;
}

function nodesToCandidates(nodes: ResolvedNode[]): PolicyCandidate[] {
  return nodes.map((n) => ({
    id: n.name,
    name: n.name,
    ref: n.resolved_commit ?? n.constraint,
    constraint: n.constraint ?? n.resolved_commit,
    depth: n.depth,
    direct: n.depth === 1,
    kind: n.kind,
    path: n.path,
    source: n.kind === "local" ? "local" : undefined,
  }));
}

async function extractArchiveIntoProject(archivePath: string, cwd: string): Promise<void> {
  const resolvedArchive = resolve(archivePath);
  try {
    await extractPackArchive({
      archivePath: resolvedArchive,
      outputDir: cwd,
      cwd,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new InstallError("INSTALL_ARCHIVE", `Install from archive failed: ${message}`, {
      cause,
      details: { archivePath: resolvedArchive },
    });
  }

  // Fail closed if landed layout has no dual-read parseable manifest
  try {
    loadManifest({ cwd });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new InstallError(
      "INSTALL_ARCHIVE",
      `Archive install left no parseable manifest under project root: ${message}`,
      { cause, details: { archivePath: resolvedArchive } },
    );
  }
}

function assertForcedTargetRegistered(
  forcedTargetId: string | undefined,
  registry: TargetRegistry | undefined,
): void {
  if (!forcedTargetId) return;
  if (!registry || !findTarget(registry, forcedTargetId)) {
    throw new InstallError(
      "INSTALL_UNKNOWN_TARGET",
      `Unknown or unregistered target: ${forcedTargetId}`,
      { details: { target: forcedTargetId } },
    );
  }
}

async function resolveActiveTargets(args: {
  cwd: string;
  rootManifest: BapmManifest;
  registry?: TargetRegistry;
  override?: string[];
  forcedTargetId?: string;
}): Promise<string[]> {
  if (args.override && args.override.length > 0) return [...args.override];

  if (args.forcedTargetId) {
    return [args.forcedTargetId];
  }

  const declared = declaredTargetIds(args.rootManifest);
  if (declared.length > 0) return declared;

  if (!args.registry) return [];

  const active: string[] = [];
  for (const t of listRegistry(args.registry)) {
    try {
      if (await t.detect({ cwd: args.cwd })) active.push(String(t.id));
    } catch {
      /* ignore detect errors */
    }
  }
  return active;
}

function listRegistry(registry: TargetRegistry): BapmTarget[] {
  if (typeof registry.list === "function") return registry.list();
  if (typeof registry.getAll === "function") return registry.getAll();
  return [];
}

function findTarget(registry: TargetRegistry, id: string): BapmTarget | undefined {
  if (typeof registry.get === "function") {
    const t = registry.get(id);
    if (t) return t;
  }
  return listRegistry(registry).find((t) => String(t.id) === id);
}

function collectPackageDeclaredTargets(
  nodes: ResolvedNode[],
  primitives: AttributedPrimitive[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const n of nodes) {
    const root = n.packageRoot;
    if (!root || !existsSync(root)) continue;
    try {
      const { document } = loadManifest({ cwd: root });
      map.set(n.name, declaredTargetIds(document));
    } catch {
      map.set(n.name, []);
    }
  }

  for (const p of primitives) {
    if (!p.packageName || map.has(p.packageName)) continue;
    if (p.source === "local") continue;
    const pkgRoot = findManifestRoot(p.path);
    if (!pkgRoot) {
      map.set(p.packageName, []);
      continue;
    }
    try {
      const { document } = loadManifest({ cwd: pkgRoot });
      map.set(p.packageName, declaredTargetIds(document));
    } catch {
      map.set(p.packageName, []);
    }
  }

  return map;
}

function findManifestRoot(filePath: string): string | undefined {
  let dir = resolve(filePath);
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, "apm.yml")) || existsSync(join(dir, "bapm.yml"))) {
      return dir;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

function filterByIntersection(
  primitives: AttributedPrimitive[],
  activeTargetId: string,
  packageTargets: Map<string, string[]>,
  rootManifest: BapmManifest,
): AttributedPrimitive[] {
  const rootDeclared = declaredTargetIds(rootManifest);
  const consumerAuth = new Set(rootDeclared.length > 0 ? rootDeclared : [activeTargetId]);
  if (!consumerAuth.has(activeTargetId)) return [];

  return primitives.filter((p) => {
    if (p.source === "local") {
      return consumerAuth.has(activeTargetId);
    }
    const pkgName = p.packageName ?? p.source.slice("dependency:".length);
    const declared = packageTargets.get(pkgName);
    if (!declared || declared.length === 0) {
      return true;
    }
    return declared.includes(activeTargetId);
  });
}

function extractDeclarationOrder(manifest: BapmManifest): string[] {
  const apm = manifest.dependencies?.apm;
  if (!Array.isArray(apm)) return [];
  const names: string[] = [];
  for (const entry of apm) {
    const n = entryNameHint(entry);
    if (n) names.push(n);
  }
  return names;
}

function entryNameHint(entry: DependencyEntry): string | undefined {
  if (typeof entry === "string") return entry.split("/").pop();
  const o = entry as ObjectDependency;
  if (o.alias && typeof o.alias === "string") return o.alias;
  if (o.path) {
    return o.path.replace(/^\.\//, "").split("/").filter(Boolean).pop();
  }
  if (o.git) {
    return o.git
      .replace(/\.git$/i, "")
      .split("/")
      .pop();
  }
  if (o.id) return o.id;
  return undefined;
}

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function restoreGitUrl(repoUrl: string | undefined): string | undefined {
  if (!repoUrl) return undefined;
  if (repoUrl.startsWith("local:")) return undefined;
  if (repoUrl.includes("://")) return repoUrl;
  return `https://${repoUrl}`;
}
