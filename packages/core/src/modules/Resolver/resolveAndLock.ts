import { resolve } from "node:path";
import { loadManifest } from "@/modules/Manifest";
import {
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
import { downloadPackages } from "./download.ts";
import { purgeModulesInstallPaths } from "./purge.ts";
import { resolveDependencyGraph } from "./resolveGraph.ts";
import type { ResolveAndLockOptions, ResolveAndLockResult, ResolvedNode } from "./types.ts";
import { DEFAULT_PARALLEL_DOWNLOADS } from "./constants.ts";
import { classifyDependencyRef } from "./classify.ts";
import type { DependencyEntry, ObjectDependency } from "@/modules/Manifest";
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
  });

  const candidates = nodesToPolicyCandidates(graph.nodes);
  const gate = assertPolicyGateAllows({
    cwd,
    policyPath: options.policyPath ?? options.policy,
    policy: options.policy ?? options.policyPath,
    noPolicy: options.noPolicy,
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
    source: n.kind === "local" ? "local" : undefined,
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
    const prev = existingByIdentity.get(n.repo_url ?? n.identity);
    if (prev?.deployed_file_hashes) entry.deployed_file_hashes = prev.deployed_file_hashes;
    // Extra diagnostic fields accepted by M2 (unknown keys retained)
    (entry as Record<string, unknown>).resolved_by = n.resolved_by;
    (entry as Record<string, unknown>).depth = n.depth;
    deps.push(entry);
  }

  const version =
    existing?.lockfile_version === "2" || deps.some((d) => d.constraint || d.resolved_tag)
      ? ("2" as const)
      : existing?.lockfile_version === "1"
        ? ("1" as const)
        : ("1" as const);

  // Force "2" when git-semver fields present (M2 serialize also bumps)
  const lockfile_version: "1" | "2" = deps.some((d) => d.constraint || d.resolved_tag)
    ? "2"
    : version;

  return {
    lockfile_version,
    dependencies: deps,
    generated_at: new Date().toISOString(),
    ...(existing?.local_deployed_file_hashes
      ? { local_deployed_file_hashes: existing.local_deployed_file_hashes }
      : {}),
  };
}
