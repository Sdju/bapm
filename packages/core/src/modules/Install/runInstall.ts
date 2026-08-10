import { isAbsolute, join, relative, resolve } from "node:path";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import type {
  BapmIntegration,
  ConfigureMcpReport,
  MaterializeReport,
  IntegrationRegistry,
} from "@b-apm/integration-api";
import { getConfigureMcp } from "@b-apm/integration-api";
import {
  loadManifest,
  type BapmManifest,
  type DependencyEntry,
  type ObjectDependency,
} from "@/modules/Manifest";
import {
  collectTreeSha256Violations,
  loadLockfileOrNull,
  writeLockfile,
  type LockfileDocument,
} from "@/modules/Lockfile";
import {
  APM_MODULES_DIR,
  DEFAULT_PARALLEL_DOWNLOADS,
  downloadPackages,
  ensureLocalSourcesUntracked,
  materializeRegistryNodes,
  resolveAndLock,
  resolveDependencyGraph,
  type ResolvedNode,
} from "@/modules/Resolver";
import {
  assertPolicyGateAllows,
  runPolicyGate,
  type PolicyCandidate,
  type PolicyExecutables,
} from "@/modules/Policy";
import {
  discoverPrimitives,
  resolvePrimitiveConflicts,
  type AttributedPrimitive,
} from "@/modules/Primitives";
import {
  discoverAgentPluginSkills,
  discoverAgentPluginDeclaredPaths,
  AgentPluginsError,
} from "@/modules/AgentPlugins";
import { extractPackArchive } from "@/modules/Pack";
import {
  loadUserExecutableGrants,
  parseExecutableGrants,
  resolveExecutableTrust,
  userGrantsToSurface,
} from "@/modules/ExecutableTrust";
import {
  applyMcpInventoryToLock,
  bakeMcpServerMaps,
  collectMcpServers,
  McpEnvBakeError,
} from "@/modules/Mcp";
import {
  applyDeployedHashesToLock,
  cleanupOrphanDeployedFiles,
  collectDeployedHashes,
  verifyDeployedFileHashes,
} from "./deployedInventory.ts";
import { InstallError } from "./errors.ts";
import { enforceFrozen } from "./frozen.ts";
import { gateInsecureBeforeFetch, normalizeAllowInsecureHosts } from "./insecurePolicy.ts";
import {
  assertMarketplacePackageRefsResolvable,
  autoCreateMinimalManifest,
  manifestExistsAt,
  normalizeExcludeIds,
  normalizePackageRefs,
  packageRefToEntry,
  writeManifestWithPackageRefs,
} from "./packageRefs.ts";
import { declaredTargetIds } from "./targets.ts";
import type { InstallOnlyMode, InstallResult, RunInstallOptions } from "./types.ts";

/**
 * Run install: optional archive extract → frozen gate → plan → policy gate →
 * download → orphan cleanup → primitives → targets → MCP trust/configure →
 * write deployed_file_hashes / mcp_* lock fields.
 *
 * With `dryRun: true`, returns after direct-deps (+ MCP view) preview and optional
 * policy preflight — no durable project writes and no target write ports.
 */
export async function runInstall(options: RunInstallOptions = {}): Promise<InstallResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const frozen = options.frozen === true;
  const dryRun = options.dryRun === true;
  const updateRefs = options.updateRefs === true || options.update === true;
  const forcedTargetId = options.forcedTarget ?? options.forceTarget;
  const policyPath = options.policyPath ?? options.policy;
  const noPolicy = options.noPolicy === true;
  const trustTransitiveMcp = options.trustTransitiveMcp === true;
  const packageRefs = normalizePackageRefs(options.packageRefs);
  const excludeIds = normalizeExcludeIds(options);
  const excludeSet = new Set(excludeIds);
  const only = normalizeOnlyMode(options.only);
  const skipApmMaterialize = only === "mcp";
  const skipMcpConfigure = only === "apm";
  // Accepted for CLI parity; must not refresh refs / bypass frozen / disable policy.
  void options.force;
  const allowInsecure = options.allowInsecure === true;
  const allowInsecureHosts = options.allowInsecureHosts;
  const dev = options.dev === true;
  const registry = (options.integrationRegistry ?? options.registry) as
    | IntegrationRegistry
    | undefined;

  const policyPorts = {
    policyProviders: options.policyProviders ?? options.providers,
    providers: options.providers ?? options.policyProviders,
    listGitRemotes: options.listGitRemotes,
    remotes: options.remotes,
    fetchPolicyUrl: options.fetchPolicyUrl,
    httpGet: options.httpGet,
    fetchAncestor: options.fetchAncestor,
    defaultFetchFailure: options.defaultFetchFailure,
    implementationDefaultHost: options.implementationDefaultHost,
  };

  if (options.archivePath && packageRefs.length > 0) {
    throw new InstallError(
      "INSTALL_PACKAGE_REF",
      "Cannot combine archive zip install with positional package refs",
      { details: { archivePath: options.archivePath, packageRefs } },
    );
  }

  if (packageRefs.length > 0 && frozen && !dryRun) {
    throw new InstallError(
      "INSTALL_FROZEN_POSITIONAL",
      "Frozen mode rejects positional package-ref add (manifest mutation)",
      { details: { frozen: true, packageRefs } },
    );
  }

  // Validate package refs early (also for dry-run preview)
  for (const ref of packageRefs) {
    packageRefToEntry(ref);
  }
  // G5: marketplace positional miss must fail before manifest mutation
  if (packageRefs.length > 0) {
    await assertMarketplacePackageRefsResolvable(packageRefs, {
      configDir: options.configDir ?? options.marketplaceConfigDir,
      marketplaceConfigDir: options.marketplaceConfigDir ?? options.configDir,
    });
  }

  if (options.archivePath && !dryRun) {
    await extractArchiveIntoProject(options.archivePath, cwd);
  }

  if (frozen && !dryRun) {
    enforceFrozen({ cwd, updateRefs, update: options.update });
  }

  if (packageRefs.length > 0 && !dryRun) {
    if (!manifestExistsAt(cwd)) {
      autoCreateMinimalManifest(cwd);
    }
    const loaded = loadManifest({ cwd });
    writeManifestWithPackageRefs({
      cwd,
      document: loaded.document,
      sourcePath: loaded.sourcePath,
      sourceFilename: loaded.sourceFilename,
      refs: packageRefs,
      dev,
    });
  }

  if (dryRun) {
    return runDryRunPreview({
      cwd,
      packageRefs,
      dev,
      allowInsecure,
      allowInsecureHosts,
      policyPath,
      noPolicy,
      policyPorts,
      activeTargets: [],
    });
  }

  const { document: rootManifest } = loadManifest({ cwd });
  const previousLock = loadLockfileOrNull({ cwd });

  const insecureGate = gateInsecureBeforeFetch({
    cwd,
    document: rootManifest,
    allowInsecure,
    allowInsecureHosts,
  });
  const insecureDiagnostics = insecureGate.warnings.map((message) => ({
    code: "INSECURE_HTTP",
    message,
    warn: true,
  }));

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

  if (!skipApmMaterialize) {
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
      ensureLocalSourcesUntracked({ projectRoot: cwd, manifest: rootManifest });
      policyDiagnostics = applyPolicyGate({
        cwd,
        policyPath,
        noPolicy,
        nodes,
        ...policyPorts,
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
        // lk-015: re-verify git tree_sha256 fail-closed
        verifyTreeSha256OrThrow({ cwd, document: lockDocument });
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
        marketplaceConfigDir: options.marketplaceConfigDir ?? options.configDir,
        configDir: options.configDir ?? options.marketplaceConfigDir,
        ...ports,
        ...policyPorts,
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
  } else {
    // only=mcp: skip APM download/materialize; still apply policy on declared names when possible
    policyDiagnostics = applyPolicyGate({
      cwd,
      policyPath,
      noPolicy,
      nodes: [],
      candidatesOverride: extractDeclarationOrder(rootManifest).map((name) => ({
        id: name,
        name,
        ref: name,
        direct: true,
        depth: 1,
      })),
      ...policyPorts,
    });
    lockPath = previousLock?.sourcePath;
    lockDocument = previousLock?.document;
  }

  const currentDepNames = new Set(nodes.map((n) => n.name).filter(Boolean));

  if (!frozen && !skipApmMaterialize) {
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

  const nativeRaw = skipApmMaterialize
    ? []
    : discoverPrimitives({
        cwd,
        modulesDir: join(cwd, APM_MODULES_DIR),
        declarationOrder,
      });
  const raw = nativeRaw.filter(
    (primitive) => !nodes.some((node) => isPortablePluginPrimitive(node, primitive.path)),
  );
  if (!skipApmMaterialize) {
    try {
      raw.push(...discoverPortablePluginPrimitives(nodes));
    } catch (error) {
      // Declared Agent Plugins paths are requirements: fail closed before deploy
      // and do not leave a freshly written lock from this install.
      const code =
        error instanceof AgentPluginsError
          ? error.code
          : error && typeof error === "object" && "code" in error
            ? String((error as { code: unknown }).code)
            : "";
      if (
        code === "AGENT_PLUGIN_DECLARED_PATH_INVALID" &&
        !previousLock &&
        lockPath &&
        existsSync(lockPath)
      ) {
        try {
          unlinkSync(lockPath);
        } catch {
          /* best-effort rollback */
        }
        // Also clear common lock filenames if resolve wrote a different path.
        for (const name of ["bapm.lock.yaml", "apm.lock.yaml"]) {
          const candidate = join(cwd, name);
          if (existsSync(candidate)) {
            try {
              unlinkSync(candidate);
            } catch {
              /* best-effort */
            }
          }
        }
      }
      throw error;
    }
  }
  const resolved = skipApmMaterialize
    ? { primitives: [] as AttributedPrimitive[], diagnostics: [] as unknown[] }
    : resolvePrimitiveConflicts({
        primitives: raw,
        declarationOrder,
      });

  // Resolve target state only after independent preconditions (manifest,
  // frozen, resolution, and policy) pass, but before target harness writes.
  assertForcedTargetRegistered(forcedTargetId, registry);
  assertRegisteredExcludeIds(excludeIds, registry);
  const activeTargets = await resolveActiveTargets({
    cwd,
    registry,
    override: options.activeTargets,
    forcedTargetId,
    manifestActive: rootManifest.active,
  });
  assertActiveTargetsRegistered(activeTargets, registry);

  const allDeployed: ReturnType<typeof collectDeployedHashes> = [];
  const materializedPrimitives: AttributedPrimitive[] = [];

  if (!skipApmMaterialize && registry && activeTargets.length > 0) {
    const packageTargets = collectPackageDeclaredTargets(nodes, raw);
    for (const targetId of activeTargets) {
      const target = findTarget(registry, targetId);
      if (!target) continue;

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
      allDeployed.push(...collectTargetDeployedHashes(cwd, target, report));
    }
  }

  if (!frozen && !skipApmMaterialize && lockDocument && allDeployed.length > 0) {
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
  if (!skipMcpConfigure) {
    const mcpResult = await deployMcpAfterPolicy({
      cwd,
      rootManifest,
      nodes,
      registry,
      activeTargets,
      trustTransitiveMcp,
      frozen,
      excludeSet,
      lockDocument,
      lockPath,
      previousLockFilename: previousLock?.sourceFilename,
      diagnostics: mcpDiagnostics,
      configDir: options.configDir ?? options.marketplaceConfigDir,
      policyPath,
      noPolicy,
      policyPorts,
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
  }

  return {
    ok: true,
    lockPath,
    modulesDir: join(cwd, APM_MODULES_DIR),
    activeTargets,
    primitivesCount: resolved.primitives.length,
    diagnostics: [
      ...insecureDiagnostics,
      ...policyDiagnostics,
      ...resolved.diagnostics,
      ...mcpDiagnostics,
    ],
    policyDiagnostics,
  };
}

/**
 * Portable plugins are discovered only from resolver-materialized package roots.
 * The resolver remains the sole source of local/git/registry provenance.
 */
function discoverPortablePluginPrimitives(nodes: ResolvedNode[]): AttributedPrimitive[] {
  const primitives: AttributedPrimitive[] = [];
  for (const node of nodes) {
    const root = portablePluginRoot(node);
    if (!root) continue;
    const discovered = discoverAgentPluginSkills({ root, packageName: node.name });
    for (const skill of discovered.skills) {
      primitives.push({
        name: skill.name,
        type: "skill",
        source: `dependency:${node.name}`,
        packageName: node.name,
        path: skill.skillPath,
        skillDirectory: skill.directory,
        pluginRoot: discovered.root,
        format: "agent-plugin",
      });
    }
    const declared = discoverAgentPluginDeclaredPaths({ root, packageName: node.name });
    for (const item of [...declared.commands, ...declared.hooks]) {
      primitives.push({
        name: item.name,
        type: item.type,
        source: `dependency:${node.name}`,
        packageName: node.name,
        path: item.path,
        pluginRoot: declared.root,
        format: "agent-plugin",
      });
    }
  }
  return primitives;
}

function isPortablePluginPrimitive(node: ResolvedNode, primitivePath: string): boolean {
  const root = portablePluginRoot(node);
  if (!root) return false;
  const rel = relative(resolve(root), resolve(primitivePath));
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
}

function portablePluginRoot(node: ResolvedNode): string | undefined {
  for (const candidate of [node.packageRoot, node.path]) {
    if (candidate && existsSync(join(candidate, "plugin.json"))) return candidate;
  }
  return undefined;
}

function normalizeOnlyMode(only: InstallOnlyMode | undefined): InstallOnlyMode | undefined {
  if (only === undefined || only === null) return undefined;
  if (only === "apm" || only === "mcp") return only;
  throw new InstallError(
    "INSTALL_FAILED",
    `Invalid only mode: ${String(only)} (expected "apm" or "mcp")`,
    { details: { only } },
  );
}

async function runDryRunPreview(args: {
  cwd: string;
  packageRefs: string[];
  dev?: boolean;
  allowInsecure?: boolean;
  allowInsecureHosts?: string[];
  policyPath?: string;
  noPolicy: boolean;
  policyPorts: {
    policyProviders?: string[];
    providers?: string[];
    listGitRemotes?: RunInstallOptions["listGitRemotes"];
    remotes?: RunInstallOptions["remotes"];
    fetchPolicyUrl?: RunInstallOptions["fetchPolicyUrl"];
    httpGet?: RunInstallOptions["httpGet"];
    fetchAncestor?: RunInstallOptions["fetchAncestor"];
    defaultFetchFailure?: RunInstallOptions["defaultFetchFailure"];
    implementationDefaultHost?: string;
  };
  activeTargets: string[];
}): Promise<InstallResult> {
  // Validate host tokens even on dry-run (fail-closed).
  if (args.allowInsecureHosts && args.allowInsecureHosts.length > 0) {
    normalizeAllowInsecureHosts(args.allowInsecureHosts);
  }

  const diagnostics: unknown[] = [
    {
      code: "DRY_RUN",
      message: "dry-run preview; no changes made",
      dryRun: true,
      preview: true,
    },
  ];

  let rootManifest: BapmManifest | undefined;
  if (manifestExistsAt(args.cwd)) {
    rootManifest = loadManifest({ cwd: args.cwd }).document;
  } else if (args.packageRefs.length === 0) {
    // Preserve bare-install fail-closed (no auto-create without positional).
    loadManifest({ cwd: args.cwd });
  }

  if (args.packageRefs.length > 0) {
    const section = args.dev ? "devDependencies.apm" : "dependencies.apm";
    diagnostics.push({
      code: "DRY_RUN_WOULD_ADD",
      message: `would add package refs under ${section}: ${args.packageRefs.join(", ")}`,
      wouldAdd: args.packageRefs,
      wouldAddSection: section,
      preview: true,
      dryRun: true,
    });
  }

  const directApm = [
    ...(rootManifest?.dependencies?.apm ?? []),
    ...(rootManifest?.devDependencies?.apm ?? []),
  ];
  const directPreview = directApm.map((entry) => summarizeDirectEntry(entry));
  for (const ref of args.packageRefs) {
    if (!directPreview.includes(ref)) directPreview.push(ref);
  }
  diagnostics.push({
    code: "DRY_RUN_DIRECT_DEPS",
    message: `would install direct dependencies: ${directPreview.join(", ") || "(none)"}`,
    directDependencies: directPreview,
    preview: true,
    dryRun: true,
  });

  const mcpDeps = rootManifest?.dependencies?.mcp;
  if (Array.isArray(mcpDeps) && mcpDeps.length > 0) {
    diagnostics.push({
      code: "DRY_RUN_MCP_VIEW",
      message: `MCP deps view: ${mcpDeps.length} direct server(s)`,
      mcpCount: mcpDeps.length,
      preview: true,
      dryRun: true,
    });
  }

  // Optional policy preflight on direct set only (no full resolve/download).
  let policyDiagnostics: unknown[] = [];
  if (!args.noPolicy) {
    const candidates: PolicyCandidate[] = [];
    for (const entry of directApm) {
      const hint = entryNameHint(entry) ?? summarizeDirectEntry(entry);
      candidates.push({
        id: hint,
        name: hint,
        ref: summarizeDirectEntry(entry),
        direct: true,
        depth: 1,
        path:
          typeof entry === "object" && entry && "path" in entry
            ? String((entry as ObjectDependency).path)
            : undefined,
        source: typeof entry === "object" && entry && "path" in entry ? "local" : undefined,
      });
    }
    for (const ref of args.packageRefs) {
      candidates.push({
        id: ref,
        name: ref,
        ref,
        direct: true,
        depth: 1,
      });
    }
    if (candidates.length > 0 || args.policyPath) {
      policyDiagnostics = applyPolicyGate({
        cwd: args.cwd,
        policyPath: args.policyPath,
        noPolicy: args.noPolicy,
        nodes: [],
        candidatesOverride: candidates,
        ...args.policyPorts,
      });
    }
  }

  return {
    ok: true,
    modulesDir: join(args.cwd, APM_MODULES_DIR),
    activeTargets: args.activeTargets,
    primitivesCount: 0,
    diagnostics: [...policyDiagnostics, ...diagnostics],
    policyDiagnostics,
    dryRun: true,
  };
}

function summarizeDirectEntry(entry: DependencyEntry): string {
  if (typeof entry === "string") return entry;
  const o = entry as ObjectDependency;
  if (o.path) return String(o.path);
  if (o.git) return String(o.git);
  if (o.id) return String(o.id);
  if (o.alias) return String(o.alias);
  return entryNameHint(entry) ?? "(dep)";
}

async function deployMcpAfterPolicy(args: {
  cwd: string;
  rootManifest: BapmManifest;
  nodes: ResolvedNode[];
  registry?: IntegrationRegistry;
  activeTargets: string[];
  forcedTargetId?: string;
  trustTransitiveMcp: boolean;
  frozen: boolean;
  excludeSet: Set<string>;
  lockDocument?: LockfileDocument;
  lockPath?: string;
  previousLockFilename?: string;
  diagnostics: unknown[];
  configDir?: string;
  policyPath?: string;
  noPolicy?: boolean;
  policyPorts?: {
    policyProviders?: string[];
    providers?: string[];
    listGitRemotes?: RunInstallOptions["listGitRemotes"];
    remotes?: RunInstallOptions["remotes"];
    fetchPolicyUrl?: RunInstallOptions["fetchPolicyUrl"];
    httpGet?: RunInstallOptions["httpGet"];
    fetchAncestor?: RunInstallOptions["fetchAncestor"];
    defaultFetchFailure?: RunInstallOptions["defaultFetchFailure"];
    implementationDefaultHost?: string;
  };
}): Promise<{
  lockPath?: string;
  lockDocument?: LockfileDocument;
  withholdFatal: boolean;
  withholdMessage?: string;
  withheldPackages: string[];
}> {
  const projectSurface = parseExecutableGrants({
    manifest: args.rootManifest as Record<string, unknown>,
  });
  const userLoaded = loadUserExecutableGrants({
    configDir: args.configDir,
    configRoot: args.configDir,
  });
  const userSurface = userGrantsToSurface(userLoaded);
  const combinedSurface = {
    present: projectSurface.present || userSurface.present,
    allow: { ...projectSurface.allow, ...userSurface.allow },
    deny: { ...projectSurface.deny, ...userSurface.deny },
  };
  const orgExecutables = loadOrgExecutablesForTrust({
    cwd: args.cwd,
    policyPath: args.policyPath,
    noPolicy: args.noPolicy === true,
    policyPorts: args.policyPorts,
  });

  const collected = collectMcpServers({
    cwd: args.cwd,
    rootManifest: args.rootManifest,
    nodes: args.nodes,
    trustTransitiveMcp: args.trustTransitiveMcp,
    grantSurface: combinedSurface,
  });
  args.diagnostics.push(...collected.diagnostics);

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
    const decision = resolveExecutableTrust({
      packageName: server.packageName,
      executableType: "mcp",
      orgExecutables,
      projectSurface,
      userSurface,
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
      outcome: decision.outcome,
    });
  }

  const uniqueWithheld = [...new Set(withheldPackages)];
  const orgDenyActive = orgExecutables.deny_all === true || (orgExecutables.deny?.length ?? 0) > 0;
  const withholdFatal = uniqueWithheld.length > 0 && (combinedSurface.present || orgDenyActive);
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

  // Bapm—not package config—creates and owns portable PLUGIN_DATA directories.
  for (const server of approved) {
    if (server.format !== "agent-plugin" || !server.env?.PLUGIN_DATA) continue;
    mkdirSync(server.env.PLUGIN_DATA, { recursive: true, mode: 0o700 });
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
  let configuredServers: typeof approved | undefined;

  for (const targetId of args.activeTargets) {
    const target = findTarget(args.registry, targetId);
    if (!target) continue;

    const configureMcp = getConfigureMcp(target);
    if (!configureMcp) continue;

    if (args.excludeSet.has(targetId)) {
      args.diagnostics.push({
        code: "EXCLUDE_SKIP_MCP",
        message: `Skipping configureMcp for excluded target "${targetId}" (MCP filter; install continues)`,
        exclude: targetId,
        warn: true,
      });
      continue;
    }

    // Per-target bake: omit APM placeholder bake when mcpEnvMode === "translate".
    // Missing mode ⇒ bake (Cursor default). `{bake:NAME}` still resolved fail-closed.
    // Lookup: overrides → process.env → effective manifest `env` (fills gaps).
    const bakeMode = target.mcpEnvMode === "translate" ? "translate" : "bake";
    const manifestEnv = args.rootManifest.env;
    try {
      configuredServers = approved.map((server) =>
        bakeMcpServerMaps(server, {
          mode: bakeMode,
          ...(manifestEnv !== undefined ? { manifestEnv } : {}),
        }),
      );
    } catch (error) {
      if (error instanceof McpEnvBakeError) {
        throw new InstallError("INSTALL_MCP_ENV_BAKE", error.message, {
          details: { missing: error.missing, targetId, mcpEnvMode: bakeMode },
          cause: error,
        });
      }
      throw error;
    }

    const report = (await configureMcp(configuredServers, {
      cwd: args.cwd,
      targetId,
      deployRoots: [...target.deployRoots],
    })) as ConfigureMcpReport;
    if (!report || report.targetId !== targetId) {
      throw new InstallError(
        "INSTALL_FAILED",
        `Target "${targetId}" configured MCP without target-owned deployment attribution`,
        { details: { targetId, reportTargetId: report?.targetId } },
      );
    }
    const adapterDiagnostics = (
      report as (ConfigureMcpReport & { diagnostics?: unknown[] }) | undefined
    )?.diagnostics;
    if (adapterDiagnostics) args.diagnostics.push(...adapterDiagnostics);

    const reportedConfigPath =
      typeof report?.configPath === "string" ? report.configPath.trim() : "";
    const normalizedConfigPath = normalizeMcpConfigPath(args.cwd, reportedConfigPath);
    if (!normalizedConfigPath) {
      throw new InstallError(
        "INSTALL_FAILED",
        `Target "${targetId}" configured MCP without a usable config path (project-relative, absolute, or ~/…)`,
        { details: { targetId, configPath: report?.configPath } },
      );
    }

    wroteConfig = true;
    configuredTargetId = targetId;
    configPath = normalizedConfigPath;
    break;
  }

  let lockDocument = args.lockDocument;
  let lockPath = args.lockPath;

  if (
    wroteConfig &&
    !args.frozen &&
    lockDocument &&
    configPath &&
    configuredTargetId &&
    configuredServers
  ) {
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

/** Load effective org `executables` for MCP trust (best-effort; absent → empty). */
function loadOrgExecutablesForTrust(args: {
  cwd: string;
  policyPath?: string;
  noPolicy: boolean;
  policyPorts?: {
    policyProviders?: string[];
    providers?: string[];
    listGitRemotes?: RunInstallOptions["listGitRemotes"];
    remotes?: RunInstallOptions["remotes"];
    fetchPolicyUrl?: RunInstallOptions["fetchPolicyUrl"];
    httpGet?: RunInstallOptions["httpGet"];
    fetchAncestor?: RunInstallOptions["fetchAncestor"];
    defaultFetchFailure?: RunInstallOptions["defaultFetchFailure"];
    implementationDefaultHost?: string;
  };
}): PolicyExecutables {
  if (args.noPolicy) return { deny_all: false, deny: [] };
  try {
    const gate = runPolicyGate({
      cwd: args.cwd,
      policyPath: args.policyPath,
      policy: args.policyPath,
      noPolicy: args.noPolicy,
      providers: args.policyPorts?.providers ?? args.policyPorts?.policyProviders,
      policyProviders: args.policyPorts?.policyProviders ?? args.policyPorts?.providers,
      listGitRemotes: args.policyPorts?.listGitRemotes,
      remotes: args.policyPorts?.remotes,
      fetchPolicyUrl: args.policyPorts?.fetchPolicyUrl,
      httpGet: args.policyPorts?.httpGet,
      fetchAncestor: args.policyPorts?.fetchAncestor as never,
      defaultFetchFailure: args.policyPorts?.defaultFetchFailure,
      implementationDefaultHost: args.policyPorts?.implementationDefaultHost,
      candidates: [],
    });
    if (gate.skipped || !gate.document?.executables) {
      return { deny_all: false, deny: [] };
    }
    return {
      deny_all: gate.document.executables.deny_all === true,
      deny: Array.isArray(gate.document.executables.deny) ? gate.document.executables.deny : [],
    };
  } catch {
    // Policy gate failures are handled on the install policy path; trust floor soft-falls back.
    return { deny_all: false, deny: [] };
  }
}

/** Alias preferred by design docs. */
export const installProject = runInstall;

function verifyTreeSha256OrThrow(args: { cwd: string; document: LockfileDocument }): void {
  const violations = collectTreeSha256Violations(args);
  if (violations.length === 0) return;
  const first = violations[0]!;
  throw new InstallError("INSTALL_FROZEN_HASH_MISMATCH", first.message, {
    details: {
      entry: first.entry,
      kind: first.kind,
      expected: first.expected,
      observed: first.observed,
      integrity: "tree_sha256",
      frozen: true,
    },
  });
}

function applyPolicyGate(args: {
  cwd: string;
  policyPath?: string;
  noPolicy: boolean;
  nodes: ResolvedNode[];
  /** When set (dry-run), use these candidates instead of deriving from nodes. */
  candidatesOverride?: PolicyCandidate[];
  policyProviders?: string[];
  providers?: string[];
  listGitRemotes?: RunInstallOptions["listGitRemotes"];
  remotes?: RunInstallOptions["remotes"];
  fetchPolicyUrl?: RunInstallOptions["fetchPolicyUrl"];
  httpGet?: RunInstallOptions["httpGet"];
  fetchAncestor?: RunInstallOptions["fetchAncestor"];
  defaultFetchFailure?: RunInstallOptions["defaultFetchFailure"];
  implementationDefaultHost?: string;
}): unknown[] {
  const candidates = args.candidatesOverride ?? nodesToCandidates(args.nodes);
  const gate = assertPolicyGateAllows({
    cwd: args.cwd,
    policyPath: args.policyPath,
    policy: args.policyPath,
    noPolicy: args.noPolicy,
    providers: args.providers ?? args.policyProviders,
    policyProviders: args.policyProviders ?? args.providers,
    listGitRemotes: args.listGitRemotes,
    remotes: args.remotes,
    fetchPolicyUrl: args.fetchPolicyUrl,
    httpGet: args.httpGet,
    fetchAncestor: args.fetchAncestor as never,
    defaultFetchFailure: args.defaultFetchFailure,
    implementationDefaultHost: args.implementationDefaultHost,
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
  registry: IntegrationRegistry | undefined,
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

function assertActiveTargetsRegistered(
  activeTargets: string[],
  registry: IntegrationRegistry | undefined,
): void {
  for (const id of activeTargets) {
    if (!registry || !findTarget(registry, id)) {
      throw new InstallError("INSTALL_UNKNOWN_TARGET", `Unknown or unregistered target: ${id}`, {
        details: { target: id, activeTargets },
      });
    }
  }
}

/** Preserve first-seen order while dropping duplicates. */
function dedupePreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

async function resolveActiveTargets(args: {
  cwd: string;
  registry?: IntegrationRegistry;
  override?: string[];
  forcedTargetId?: string;
  manifestActive?: string[];
}): Promise<string[]> {
  // 1. CLI / forced --target wins over everything.
  if (args.forcedTargetId) {
    return [args.forcedTargetId];
  }

  // 2. Programmatic override (multi-capable) — same semantics as manifest `active`.
  if (args.override && args.override.length > 0) {
    return dedupePreserveOrder(args.override);
  }

  // 3. Manifest `active` (already non-empty when present after parse).
  if (args.manifestActive && args.manifestActive.length > 0) {
    return dedupePreserveOrder(args.manifestActive);
  }

  // 4. Sole auto-detect, else fail-closed.
  if (!args.registry) {
    throw new InstallError(
      "INSTALL_UNKNOWN_TARGET",
      "Target detection is unavailable; pass --target <id> or set active in the manifest",
      { details: { detectedTargets: [], registry: "missing" } },
    );
  }

  const detection = await detectRegisteredTargets(args.registry, args.cwd);
  if (detection.detectedIds.length === 1) return detection.detectedIds;
  throw new InstallError(
    "INSTALL_UNKNOWN_TARGET",
    "Target detection is missing or ambiguous; pass --target <id> or set active in the manifest",
    { details: { detectedTargets: detection.detectedIds, diagnostics: detection.diagnostics } },
  );
}

async function detectRegisteredTargets(
  registry: IntegrationRegistry,
  cwd: string,
): Promise<{ detectedIds: string[]; diagnostics: unknown[] }> {
  if (typeof registry.detect === "function") return registry.detect(cwd);

  const detectedIds: string[] = [];
  const diagnostics: unknown[] = [];
  for (const target of listRegistry(registry)) {
    try {
      if (await target.detect({ cwd })) detectedIds.push(target.id);
    } catch {
      diagnostics.push({
        targetId: target.id,
        message: `Target "${target.id}" detection did not match`,
      });
    }
  }
  return { detectedIds, diagnostics };
}

function assertRegisteredExcludeIds(
  excludeIds: string[],
  registry: IntegrationRegistry | undefined,
): void {
  for (const id of excludeIds) {
    if (!registry?.get(id)) {
      throw new InstallError(
        "INSTALL_UNKNOWN_EXCLUDE",
        `Unknown or unregistered exclude id: ${id}`,
        { details: { exclude: id } },
      );
    }
  }
}

/**
 * Trust only deployment attribution returned by the selected target. Core
 * verifies generic containment but never derives a target's paths or owners.
 */
function collectTargetDeployedHashes(
  cwd: string,
  target: BapmIntegration,
  report: void | MaterializeReport,
): ReturnType<typeof collectDeployedHashes> {
  if (report === undefined) return [];
  if (!report || !Array.isArray(report.deployedFiles)) {
    throw new InstallError(
      "INSTALL_FAILED",
      `Target "${target.id}" materialize report is missing target-owned deployment attribution`,
      { details: { targetId: target.id, report } },
    );
  }
  if (report.deployedFiles.length === 0) return [];
  if (report.targetId !== target.id) {
    throw new InstallError(
      "INSTALL_FAILED",
      `Target "${target.id}" materialize report has invalid target-owned deployment attribution`,
      { details: { targetId: target.id, reportTargetId: report.targetId } },
    );
  }

  for (const file of report.deployedFiles) {
    const relPath = typeof file?.path === "string" ? file.path.trim() : "";
    const absolutePath = relPath ? resolve(cwd, relPath) : "";
    if (!relPath || !isPathWithinTargetRoots(cwd, absolutePath, target.deployRoots)) {
      throw new InstallError(
        "INSTALL_FAILED",
        `Target "${target.id}" reported deployment outside its declared roots: ${relPath || "(missing path)"}`,
        { details: { targetId: target.id, path: relPath, deployRoots: target.deployRoots } },
      );
    }
  }
  return collectDeployedHashes(cwd, report);
}

function isPathWithinTargetRoots(cwd: string, path: string, deployRoots: string[]): boolean {
  return deployRoots.some((root) => {
    const rootPath = resolve(cwd, root);
    const rel = relative(rootPath, path);
    return (
      rel === "" ||
      (!rel.startsWith("..") && !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`))
    );
  });
}

function listRegistry(registry: IntegrationRegistry): BapmIntegration[] {
  if (typeof registry.list === "function") return registry.list();
  if (typeof registry.getAll === "function") return registry.getAll();
  return [];
}

function findTarget(registry: IntegrationRegistry, id: string): BapmIntegration | undefined {
  if (typeof registry.get === "function") {
    const t = registry.get(id);
    if (t) return t;
  }
  return listRegistry(registry).find((t) => String(t.id) === id);
}

/**
 * Normalize configureMcp report paths for lock inventory.
 * Accepts project-relative paths, absolute home/out-of-project paths, and `~/…` tilde forms.
 */
function normalizeMcpConfigPath(cwd: string, reported: string): string | undefined {
  const trimmed = reported.trim();
  if (!trimmed) return undefined;

  if (trimmed === "~" || trimmed.startsWith("~/")) {
    return trimmed.replace(/\\/g, "/");
  }

  if (isAbsolute(trimmed)) {
    return trimmed.replace(/\\/g, "/");
  }

  const resolved = resolve(cwd, trimmed);
  const rel = relative(cwd, resolved);
  if (!rel || rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    return undefined;
  }
  return rel.replace(/\\/g, "/");
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
  const apm = [
    ...(Array.isArray(manifest.dependencies?.apm) ? manifest.dependencies!.apm! : []),
    ...(Array.isArray(manifest.devDependencies?.apm) ? manifest.devDependencies!.apm! : []),
  ];
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
