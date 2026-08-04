import { resolve } from "node:path";
import { loadManifest } from "@/modules/Manifest";
import {
  loadLockfileOrNull,
  writeLockfile,
  type LockedDependency,
  type LockfileDocument,
} from "@/modules/Lockfile";
import { downloadPackages } from "./download.ts";
import { resolveDependencyGraph } from "./resolveGraph.ts";
import type { ResolveAndLockOptions, ResolveAndLockResult, ResolvedNode } from "./types.ts";
import { DEFAULT_PARALLEL_DOWNLOADS } from "./constants.ts";

/**
 * Orchestrate: load manifest → resolve → download missing → write lock via M2.
 * No target deploy. Policy skipped until M8.
 */
export async function resolveAndLock(
  options: ResolveAndLockOptions = {},
): Promise<ResolveAndLockResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const updateRefs = options.updateRefs === true;
  const parallelDownloads = options.parallelDownloads ?? DEFAULT_PARALLEL_DOWNLOADS;

  // Dual-conflict surfaces via loadLockfileOrNull / discover
  const loaded = loadLockfileOrNull({ cwd });
  const existingLock = loaded?.document ?? null;
  const sourcePath = loaded?.sourcePath;
  const sourceFilename = loaded?.sourceFilename;

  // Ensure manifest exists (throws ManifestError if missing)
  loadManifest({ cwd });

  const graph = await resolveDependencyGraph({
    cwd,
    updateRefs,
    maxDepth: options.maxDepth,
    gitRemote: options.gitRemote,
    tagLister: options.tagLister,
    downloader: options.downloader,
    existingLock,
  });

  // Ensure all nodes are materialized (resolve already downloads for transitive
  // discovery; re-run downloadPackages for completeness / parallel fill)
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
  };
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

  for (const n of nodes) {
    if (n.kind === "local") {
      deps.push({
        name: n.name,
        repo_url: n.repo_url ?? n.identity,
        source: "local",
        version: n.version,
      });
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
  };
}
