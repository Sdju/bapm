import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadManifest } from "@/modules/Manifest";
import {
  computeCanonicalTreeSha256,
  loadLockfileOrNull,
  writeLockfile,
  type LockedDependency,
  type LockfileDocument,
} from "@/modules/Lockfile";
import {
  assertPolicyGateAllows,
  type PolicyCandidate,
  type PolicyGateResult,
} from "@/modules/Policy";
import {
  createRegistryClient,
  fetchAndMaterializeRegistry,
  rewriteDownloadBase,
} from "@/modules/Registry";
import { downloadPackages } from "./download.ts";
import { purgeModulesInstallPaths } from "./purge.ts";
import { resolveDependencyGraph } from "./resolveGraph.ts";
import type { ResolveAndLockOptions, ResolveAndLockResult, ResolvedNode } from "./types.ts";
import { DEFAULT_PARALLEL_DOWNLOADS } from "./constants.ts";
import { classifyDependencyRef } from "./classify.ts";
import type { DependencyEntry, ObjectDependency } from "@/modules/Manifest";
import { ResolverError } from "./errors.ts";
import { normalizeRepoIdentity } from "./identity.ts";

/**
 * Orchestrate: load manifest → resolve plan → policy gate → download → write lock.
 */
export async function resolveAndLock(
  options: ResolveAndLockOptions = {},
): Promise<ResolveAndLockResult & { policyDiagnostics?: unknown[] }> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const updateRefs = options.updateRefs === true;
  const parallelDownloads = options.parallelDownloads ?? DEFAULT_PARALLEL_DOWNLOADS;
  const scope = options.scope ?? options.updatePackageNames;

  // Dual-conflict surfaces via loadLockfileOrNull / discover
  const loaded = loadLockfileOrNull({ cwd });
  const existingLock = loaded?.document ?? null;
  const sourcePath = loaded?.sourcePath;
  const sourceFilename = loaded?.sourceFilename;

  // Ensure manifest exists (throws ManifestError if missing)
  const { document: manifest } = loadManifest({ cwd });

  // lk-010: purge git-semver install paths for update targets before re-download
  if (updateRefs && options.purgeInstallPaths !== false) {
    const names = collectPurgeNames(manifest.dependencies?.apm, existingLock, scope);
    if (names.length > 0) {
      purgeModulesInstallPaths({
        cwd,
        packageNames: names,
        lockDeps: (existingLock?.dependencies ?? []) as Array<Record<string, unknown>>,
      });
    }
  }

  // Plan only — no durable modules for local path deps (pl-002).
  const graph = await resolveDependencyGraph({
    cwd,
    updateRefs,
    scope,
    updatePackageNames: scope,
    maxDepth: options.maxDepth,
    gitRemote: options.gitRemote,
    tagLister: options.tagLister,
    downloader: options.downloader,
    existingLock,
    skipDownload: true,
    experimentalRegistries: options.experimentalRegistries,
    registryBaseUrl: options.registryBaseUrl,
    mirrorUrl: options.mirrorUrl,
    marketplaceConfigDir: options.marketplaceConfigDir ?? options.configDir,
    configDir: options.configDir ?? options.marketplaceConfigDir,
  });

  const candidates = nodesToPolicyCandidates(graph.nodes);
  const gate = assertPolicyGateAllows({
    cwd,
    policyPath: options.policyPath ?? options.policy,
    policy: options.policy ?? options.policyPath,
    noPolicy: options.noPolicy,
    providers: options.providers ?? options.policyProviders,
    policyProviders: options.policyProviders ?? options.providers,
    listGitRemotes: options.listGitRemotes,
    remotes: options.remotes,
    fetchPolicyUrl: options.fetchPolicyUrl,
    httpGet: options.httpGet,
    fetchAncestor: options.fetchAncestor as never,
    defaultFetchFailure: options.defaultFetchFailure,
    implementationDefaultHost: options.implementationDefaultHost,
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
    graphDepth: maxNodeDepth(graph.nodes),
    maxDepthObserved: maxNodeDepth(graph.nodes),
  });

  const packages = graph.nodes
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
    parallelDownloads,
    downloader: options.downloader,
  });

  await materializeRegistryNodes(graph.nodes, {
    cwd,
    mirrorUrl: options.mirrorUrl,
    registryBaseUrl: options.registryBaseUrl,
  });

  const document = buildLockDocument(graph.nodes, existingLock);
  const lockPath = writeLockfile(document, {
    cwd,
    sourcePath,
    sourceFilename,
  });

  return {
    document: document as unknown as Record<string, unknown>,
    lockPath,
    nodes: graph.nodes,
    policyDiagnostics: collectGateDiagnostics(gate),
  };
}

export async function materializeRegistryNodes(
  nodes: ResolvedNode[],
  options: { cwd: string; mirrorUrl?: string; registryBaseUrl?: string },
): Promise<void> {
  const registryNodes = nodes.filter((n) => n.kind === "registry");
  for (const n of registryNodes) {
    if (!n.resolved_url || !n.resolved_hash || !n.version) {
      throw new Error(`Registry node ${n.name} missing resolved_url/hash/version`);
    }
    const owner = n.registry_owner ?? n.name.split("/")[0]!;
    const repo = n.registry_repo ?? n.name.split("/").slice(1).join("/");
    const baseUrl = n.registry_base_url ?? options.registryBaseUrl ?? "";
    const mirror = options.mirrorUrl ?? options.registryBaseUrl;
    const dest = n.packageRoot;
    if (!dest) throw new Error(`Registry node ${n.name} missing packageRoot`);

    let fetchUrl: string | undefined;
    if (mirror) {
      fetchUrl = rewriteDownloadBase(n.resolved_url, mirror);
    }

    const client = baseUrl
      ? createRegistryClient({ baseUrl })
      : createRegistryClient({
          baseUrl: new URL(n.resolved_url).origin,
        });

    await fetchAndMaterializeRegistry({
      cwd: options.cwd,
      baseUrl: client.baseUrl,
      owner,
      repo,
      version: n.version,
      expectedDigest: n.resolved_hash,
      dest,
      client,
      fetchUrl,
    });
  }
}

export function nodesToPolicyCandidates(nodes: ResolvedNode[]): PolicyCandidate[] {
  return nodes.map((n) => ({
    id: n.name,
    name: n.name,
    ref: n.resolved_commit ?? n.constraint,
    constraint: n.constraint ?? n.resolved_commit,
    depth: n.depth,
    direct: n.depth === 1,
    kind: n.kind,
    path: n.path,
    source: n.kind === "local" ? "local" : n.kind === "registry" ? "registry" : undefined,
  }));
}

export function maxNodeDepth(nodes: ResolvedNode[]): number {
  return nodes.reduce((m, n) => Math.max(m, n.depth ?? 0), 0);
}

export function collectGateDiagnostics(gate: PolicyGateResult): unknown[] {
  const out: unknown[] = [...gate.diagnostics];
  if (gate.result) {
    for (const w of gate.result.warnings) out.push(w);
    if (gate.result.outcome === "warn") {
      for (const v of gate.result.findings ?? gate.result.violations) {
        out.push({
          code: "POLICY_WARN",
          message: v.message,
          policy: true,
          enforcement: "warn",
        });
      }
    }
  }
  return out;
}

function collectPurgeNames(
  apm: DependencyEntry[] | undefined,
  lock: LockfileDocument | null,
  scope: string[] | undefined,
): string[] {
  const scopeSet = new Set((scope ?? []).map((s) => s.trim()).filter(Boolean));
  const names = new Set<string>();

  const consider = (name: string | undefined, repo?: string) => {
    if (!name && !repo) return;
    const base = name ?? repo?.split("/").pop() ?? "";
    if (!base) return;
    if (scopeSet.size === 0 || scopeSet.has(base) || [...scopeSet].some((s) => base.includes(s))) {
      names.add(base);
    }
  };

  for (const entry of apm ?? []) {
    if (typeof entry === "string") {
      consider(entry.split("/").pop());
      continue;
    }
    const obj = entry as ObjectDependency;
    if (obj.git) {
      const identity = normalizeRepoIdentity(obj.git);
      const classified = classifyDependencyRef(obj);
      if (classified.kind === "git-semver" || classified.kind === "git-literal") {
        consider(identity.split("/").pop(), identity);
      }
    }
    if (obj.path) {
      const pathKey = String(obj.path).replace(/^\.\//, "");
      consider(pathKey.split("/").filter(Boolean).pop());
    }
  }

  for (const dep of lock?.dependencies ?? []) {
    const name = typeof dep.name === "string" ? dep.name : undefined;
    if (!name) continue;
    if (scopeSet.size === 0 || scopeSet.has(name)) {
      names.add(name);
    }
  }

  return [...names];
}

function restoreGitUrl(repoUrl: string | undefined): string | undefined {
  if (!repoUrl) return undefined;
  if (repoUrl.startsWith("local:")) return undefined;
  if (repoUrl.includes("://")) return repoUrl;
  return `https://${repoUrl}`;
}

function buildLockDocument(
  nodes: ResolvedNode[],
  existing: LockfileDocument | null,
): LockfileDocument {
  const deps: LockedDependency[] = [];
  const existingByIdentity = new Map<string, LockedDependency>();
  for (const d of existing?.dependencies ?? []) {
    const repo = String(d.repo_url ?? "");
    if (repo) existingByIdentity.set(repo, d);
  }

  for (const n of nodes) {
    if (n.kind === "local") {
      const prev = existingByIdentity.get(n.repo_url ?? n.identity);
      const entry: LockedDependency = {
        name: n.name,
        repo_url: n.repo_url ?? n.identity,
        source: "local",
        version: n.version,
      };
      if (prev?.deployed_file_hashes) entry.deployed_file_hashes = prev.deployed_file_hashes;
      const pathField = (prev as Record<string, unknown> | undefined)?.path;
      if (typeof pathField === "string") {
        (entry as Record<string, unknown>).path = pathField;
      } else if (n.path) {
        (entry as Record<string, unknown>).path = n.path;
      }
      applyMarketplaceProvenance(entry, n);
      deps.push(entry);
      continue;
    }

    if (n.kind === "registry") {
      const entry: LockedDependency = {
        name: n.name,
        repo_url: n.repo_url ?? n.identity,
        source: "registry",
        version: n.version,
        resolved_url: n.resolved_url,
        resolved_hash: n.resolved_hash,
      };
      if (n.constraint) entry.constraint = n.constraint;
      (entry as Record<string, unknown>).resolved_by = n.resolved_by;
      (entry as Record<string, unknown>).depth = n.depth;
      applyMarketplaceProvenance(entry, n);
      deps.push(entry);
      continue;
    }

    const entry: LockedDependency = {
      name: n.name,
      repo_url: n.repo_url ?? n.identity,
      resolved_commit: n.resolved_commit,
    };
    if (n.constraint) entry.constraint = n.constraint;
    if (n.resolved_tag) entry.resolved_tag = n.resolved_tag;
    if (n.resolved_at) entry.resolved_at = n.resolved_at;
    if (n.version) entry.version = n.version;
    // APM pin identity: literal classified ref / HEAD, or picked semver tag.
    if (n.resolved_ref) {
      entry.resolved_ref = n.resolved_ref;
    } else if (n.kind === "git-semver" && n.resolved_tag) {
      entry.resolved_ref = n.resolved_tag;
    } else if (n.kind === "git-literal") {
      entry.resolved_ref = "HEAD";
    }
    const prev = existingByIdentity.get(n.repo_url ?? n.identity);
    if (prev?.deployed_file_hashes) entry.deployed_file_hashes = prev.deployed_file_hashes;
    // Extra diagnostic fields accepted by M2 (unknown keys retained)
    (entry as Record<string, unknown>).resolved_by = n.resolved_by;
    (entry as Record<string, unknown>).depth = n.depth;
    applyMarketplaceProvenance(entry, n);

    // lk-015: record canonical tree_sha256 for git-literal / git-semver
    const treeRoot = n.packageRoot;
    if (!treeRoot || !existsSync(treeRoot)) {
      throw new ResolverError(
        "RESOLVE_FAILED",
        `Cannot compute tree_sha256: missing package tree for git entry ${n.name} (${n.repo_url ?? n.identity})`,
        { details: { name: n.name, packageRoot: treeRoot } },
      );
    }
    try {
      entry.tree_sha256 = computeCanonicalTreeSha256(treeRoot);
    } catch (cause) {
      throw new ResolverError(
        "RESOLVE_FAILED",
        `Failed to compute tree_sha256 for git entry ${n.name} (${n.repo_url ?? n.identity})`,
        { cause, details: { name: n.name, packageRoot: treeRoot } },
      );
    }

    deps.push(entry);
  }

  const hasRegistry = deps.some((d) => d.source === "registry");
  const version =
    existing?.lockfile_version === "2" ||
    hasRegistry ||
    deps.some((d) => d.constraint || d.resolved_tag)
      ? ("2" as const)
      : existing?.lockfile_version === "1"
        ? ("1" as const)
        : ("1" as const);

  // Force "2" when git-semver fields or registry present
  const lockfile_version: "1" | "2" =
    hasRegistry || deps.some((d) => d.constraint || d.resolved_tag) ? "2" : version;

  const document: LockfileDocument = {
    lockfile_version,
    dependencies: deps,
    generated_at: new Date().toISOString(),
    ...(existing?.local_deployed_file_hashes
      ? { local_deployed_file_hashes: existing.local_deployed_file_hashes }
      : {}),
  };

  // Opaque carry of inventory bags (mcp_*, lsp_*, deployments, x-*, unknowns).
  // Do not invent bags; do not overwrite freshly built core fields.
  if (existing) {
    const reserved = new Set([
      "lockfile_version",
      "dependencies",
      "generated_at",
      "local_deployed_file_hashes",
    ]);
    for (const [key, value] of Object.entries(existing)) {
      if (reserved.has(key)) continue;
      if (value === undefined || value === null) continue;
      if (key in document) continue;
      (document as Record<string, unknown>)[key] = value;
    }
  }

  return document;
}

function applyMarketplaceProvenance(
  entry: LockedDependency,
  n: ResolvedNode,
): void {
  if (n.discovered_via) entry.discovered_via = n.discovered_via;
  if (n.marketplace_plugin_name) entry.marketplace_plugin_name = n.marketplace_plugin_name;
  if (n.source_url) entry.source_url = n.source_url;
  if (n.source_digest) entry.source_digest = n.source_digest;
}
