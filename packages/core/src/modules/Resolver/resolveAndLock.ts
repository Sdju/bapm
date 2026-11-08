import { existsSync } from "node:fs";
import { isAbsolute, posix, relative, resolve } from "node:path";
import { loadManifest, withEffectiveDirectDeps } from "@/modules/Manifest";
import {
  computeCanonicalTreeSha256,
  loadEffectiveLockfileOrNull,
  partitionAndWriteLockfiles,
  stampPersonalScope,
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
import { ensureLocalSourcesUntracked } from "./ensureLocalUntracked.ts";
import { effectiveLocalPath } from "./localSource.ts";

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

  // Dual-conflict surfaces via shared discover; merge includes personal when present
  const loaded = loadEffectiveLockfileOrNull({ cwd });
  const existingLock = loaded?.document ?? null;
  const sourcePath = loaded?.sourcePath;
  const sourceFilename = loaded?.sourceFilename;

  // Ensure manifest exists (throws ManifestError if missing)
  const { document: loadedManifest } = loadManifest({ cwd });
  const manifest = withEffectiveDirectDeps(loadedManifest);

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

  // Bapm `local` sources: append covering .gitignore / fail if already tracked.
  // Plain OpenAPM `path:` does not trigger this gate.
  ensureLocalSourcesUntracked({ projectRoot: cwd, manifest });

  const candidates = nodesToPolicyCandidates(graph.nodes);
  const gate = assertPolicyGateAllows({
    cwd,
    policyPath: options.policyPath ?? options.policy,
    policy: options.policy ?? options.policyPath,
    noPolicy: options.noPolicy,
    noRepoPolicy: options.noRepoPolicy,
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
      repoUrl: n.kind === "local" ? undefined : (n.gitUrl ?? restoreGitUrl(n.repo_url)),
      path: n.path,
      commit: n.resolved_commit,
      identity: n.identity,
      name: n.name,
    }));

  // lk-010: purge only after the complete graph passed boundary and policy checks.
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

  const document = buildLockDocument(graph.nodes, existingLock, cwd);
  const written = partitionAndWriteLockfiles(document, {
    cwd,
    sourcePath,
    sourceFilename,
  });
  const lockPath = written.sharedPath;

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
    if ("local" in obj) {
      const pathKey = effectiveLocalPath(obj.local).replace(/^\.\//, "");
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

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}

function isAbsolutePortablePath(value: string): boolean {
  const normalized = toPosixPath(value);
  return isAbsolute(normalized) || /^[A-Za-z]:\//.test(normalized);
}

function escapesProjectRoot(relPosix: string): boolean {
  return relPosix === ".." || relPosix.startsWith("../") || isAbsolutePortablePath(relPosix);
}

/**
 * Local lock `path` is a portable project-relative POSIX path (e.g. `pkgs/a`).
 * Paths outside the project stay absolute because they cannot be made portable
 * relative to the shared lock root.
 */
function toProjectRelativeLockPath(absPath: string, cwd: string): string {
  const abs = resolve(absPath);
  const relPosix = toPosixPath(relative(resolve(cwd), abs));
  return escapesProjectRoot(relPosix) || relPosix === "" ? toPosixPath(abs) : relPosix;
}

/**
 * Normalizes a previously locked local path. An absolute path is only reusable
 * when it still lives inside this project; foreign-machine absolute paths are
 * dropped so the current resolution wins instead of being carried forward.
 */
function normalizeLockedLocalPath(prevPath: string, cwd: string): string | undefined {
  const raw = toPosixPath(prevPath).trim();
  if (!raw) return undefined;
  if (isAbsolutePortablePath(raw)) {
    const relPosix = toPosixPath(relative(resolve(cwd), resolve(raw)));
    if (escapesProjectRoot(relPosix) || relPosix === "") return undefined;
    return relPosix;
  }
  const relPosix = posix.normalize(raw);
  return escapesProjectRoot(relPosix) || relPosix === "" ? undefined : relPosix;
}

type ExistingLocalIndex = {
  byProjectPath: Map<string, LockedDependency>;
  byName: Map<string, LockedDependency[]>;
};

function isExistingLocalRow(dep: LockedDependency): boolean {
  const raw = dep as Record<string, unknown>;
  const repo = typeof raw.repo_url === "string" ? raw.repo_url : "";
  return (
    raw.source === "local" ||
    repo.startsWith("local:") ||
    repo.startsWith("_local/") ||
    (typeof raw.local_path === "string" && raw.local_path.length > 0)
  );
}

/**
 * Index APM/bapm local lock rows for rewrite matching. APM writes
 * `repo_url: _local/<name>` with `local_path`; bapm writes `local:<rel>` with
 * `path`, so matching cannot rely on repo identity alone.
 */
function buildExistingLocalIndex(
  existing: LockfileDocument | null,
  cwd: string,
): ExistingLocalIndex {
  const byProjectPath = new Map<string, LockedDependency>();
  const byName = new Map<string, LockedDependency[]>();
  for (const dep of existing?.dependencies ?? []) {
    if (!isExistingLocalRow(dep)) continue;
    const raw = dep as Record<string, unknown>;
    for (const field of ["path", "local_path"] as const) {
      const value = raw[field];
      if (typeof value !== "string") continue;
      const normalized = normalizeLockedLocalPath(value, cwd);
      if (normalized) byProjectPath.set(normalized, dep);
    }
    const name = typeof raw.name === "string" ? raw.name : "";
    if (name) {
      const list = byName.get(name) ?? [];
      list.push(dep);
      byName.set(name, list);
    }
  }
  return { byProjectPath, byName };
}

function findExistingLocal(
  node: ResolvedNode,
  index: ExistingLocalIndex,
  byIdentity: Map<string, LockedDependency>,
  cwd: string,
): LockedDependency | undefined {
  const direct = byIdentity.get(node.repo_url ?? node.identity);
  if (direct && isExistingLocalRow(direct)) return direct;

  const currentPath = node.path ? toProjectRelativeLockPath(node.path, cwd) : undefined;
  if (currentPath) {
    const byPath = index.byProjectPath.get(currentPath);
    if (byPath) return byPath;
  }

  const byApmIdentity = byIdentity.get(`_local/${node.name}`);
  if (byApmIdentity && isExistingLocalRow(byApmIdentity)) return byApmIdentity;

  const nameMatches = index.byName.get(node.name) ?? [];
  return nameMatches.length === 1 ? nameMatches[0] : undefined;
}

function stringifyResolvedBy(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    const parts = value.map((part) => String(part).trim()).filter(Boolean);
    return parts.length > 0 ? parts.join("->") : undefined;
  }
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : undefined;
}

function resolvedBySegments(node: ResolvedNode): string[] {
  const raw = (node as { resolved_by?: unknown }).resolved_by;
  if (Array.isArray(raw)) return raw.map((part) => String(part).trim()).filter(Boolean);
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return [];
  return text
    .split("->")
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Parent package name from the resolve chain (`root->parent->child`).
 * APM stores the parent identity in `declaring_parent`; bapm's chain segment
 * is the declaring package's manifest name, the closest available identity.
 */
function declaringParentOf(node: ResolvedNode): string | undefined {
  const segments = resolvedBySegments(node);
  if (segments.length < 2) return undefined;
  let parentIndex = segments.length - 2;
  // Be tolerant of a chain that omits the leaf segment.
  if (segments[parentIndex] === node.name && parentIndex > 0) parentIndex -= 1;
  return segments[parentIndex] || undefined;
}

/**
 * Local path wire value. Direct deps use the project-relative path (same as
 * `path`). Transitive deps prefer a path relative to the declaring package
 * (APM `local_path` semantics); `path` remains the project-relative alias.
 */
function localPathForLock(
  node: ResolvedNode,
  nodes: ResolvedNode[],
  projectRelative: string | undefined,
): string | undefined {
  if (node.depth <= 1 || !node.path) return projectRelative;
  const parentName = declaringParentOf(node);
  if (!parentName) return projectRelative;
  const parentCandidates = nodes.filter(
    (candidate) =>
      candidate !== node &&
      candidate.name === parentName &&
      candidate.depth === node.depth - 1 &&
      (candidate.path || candidate.packageRoot),
  );
  if (parentCandidates.length !== 1) return projectRelative;
  const parentRoot = parentCandidates[0]!.path ?? parentCandidates[0]!.packageRoot!;
  const rel = toPosixPath(relative(resolve(parentRoot), resolve(node.path)));
  if (!rel || isAbsolutePortablePath(rel)) return projectRelative;
  return rel;
}

function computeLocalContentHash(node: ResolvedNode): string {
  const root = node.packageRoot ?? node.path;
  if (!root || !existsSync(root)) {
    throw new ResolverError(
      "RESOLVE_FAILED",
      `Cannot compute content_hash: missing local package tree for ${node.name} (${node.repo_url ?? node.identity})`,
      { details: { name: node.name, packageRoot: root } },
    );
  }
  try {
    return computeCanonicalTreeSha256(root);
  } catch (cause) {
    throw new ResolverError(
      "RESOLVE_FAILED",
      `Failed to compute content_hash for local entry ${node.name} (${node.repo_url ?? node.identity})`,
      { cause, details: { name: node.name, packageRoot: root } },
    );
  }
}

function buildLockDocument(
  nodes: ResolvedNode[],
  existing: LockfileDocument | null,
  cwd: string,
): LockfileDocument {
  const deps: LockedDependency[] = [];
  const existingByIdentity = new Map<string, LockedDependency>();
  const existingLocal = buildExistingLocalIndex(existing, cwd);
  for (const d of existing?.dependencies ?? []) {
    const repo = String(d.repo_url ?? "");
    if (repo) existingByIdentity.set(repo, d);
  }

  for (const n of nodes) {
    if (n.kind === "local") {
      const prev = findExistingLocal(n, existingLocal, existingByIdentity, cwd);
      const entry: LockedDependency = {
        name: n.name,
        repo_url: n.repo_url ?? n.identity,
        source: "local",
        version: n.version,
      };
      if (prev?.deployed_file_hashes) entry.deployed_file_hashes = prev.deployed_file_hashes;
      const prevPathField = (prev as Record<string, unknown> | undefined)?.path;
      const prevLocalPathField = (prev as Record<string, unknown> | undefined)?.local_path;
      const prevPath =
        typeof prevPathField === "string"
          ? normalizeLockedLocalPath(prevPathField, cwd)
          : undefined;
      // APM lock rows may carry only `local_path` (direct deps are project-relative).
      const prevLocalPath =
        typeof prevLocalPathField === "string"
          ? normalizeLockedLocalPath(prevLocalPathField, cwd)
          : undefined;
      const currentPath = n.path ? toProjectRelativeLockPath(n.path, cwd) : undefined;
      const lockPath = prevPath ?? prevLocalPath ?? currentPath;
      if (lockPath) {
        (entry as Record<string, unknown>).path = lockPath;
      }

      const resolvedBy = stringifyResolvedBy(n.resolved_by);
      const declaringParent = declaringParentOf(n);
      const localPath = localPathForLock(n, nodes, lockPath);
      if (resolvedBy) (entry as Record<string, unknown>).resolved_by = resolvedBy;
      if (declaringParent) {
        (entry as Record<string, unknown>).declaring_parent = declaringParent;
      }
      if (localPath) (entry as Record<string, unknown>).local_path = localPath;
      (entry as Record<string, unknown>).package_type = "local";
      (entry as Record<string, unknown>).depth = n.depth;
      // `is_dev` has no reliable source in the local resolve graph yet. Preserve
      // an APM-authored value on rewrite instead of inventing a guess.
      const prevIsDev = (prev as Record<string, unknown> | undefined)?.is_dev;
      if (prevIsDev === true) (entry as Record<string, unknown>).is_dev = true;
      // APM-only absolute anchor: carry when present so a round-trip does not
      // discard evidence bapm cannot recompute.
      const prevAnchor = (prev as Record<string, unknown> | undefined)?.anchored_local_path;
      if (typeof prevAnchor === "string" && prevAnchor) {
        (entry as Record<string, unknown>).anchored_local_path = prevAnchor;
      }
      entry.content_hash = computeLocalContentHash(n);

      applyMarketplaceProvenance(entry, n);
      if (n.personalLockScope) {
        deps.push(stampPersonalScope(entry as Record<string, unknown>) as LockedDependency);
      } else {
        deps.push(entry);
      }
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
    if (n.virtualPath) entry.virtual_path = n.virtualPath;
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

function applyMarketplaceProvenance(entry: LockedDependency, n: ResolvedNode): void {
  if (n.discovered_via) entry.discovered_via = n.discovered_via;
  if (n.marketplace_plugin_name) entry.marketplace_plugin_name = n.marketplace_plugin_name;
  if (n.source_url) entry.source_url = n.source_url;
  if (n.source_digest) entry.source_digest = n.source_digest;
}
