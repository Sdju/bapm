/**
 * Resolver — classify, BFS resolve, download into `apm_modules`, `resolveAndLock`.
 *
 * ## Public API
 *
 * - Constants: `APM_MODULES_DIR`, `MAX_RESOLVE_DEPTH`, `DEFAULT_PARALLEL_DOWNLOADS`
 * - Classify: `classifyDependencyRef`
 * - Resolve: `resolveDependencyGraph`
 * - Download: `downloadPackages`
 * - Orchestrate: `resolveAndLock`
 * - Errors: `ResolverError`
 * - Ports: `TagLister`, `GitRemote`, `Downloader`
 *
 * ## Example
 *
 * ```ts
 * import { resolveAndLock } from "@/modules/Resolver";
 * await resolveAndLock({ cwd: process.cwd() });
 * ```
 */
export { APM_MODULES_DIR, MAX_RESOLVE_DEPTH, DEFAULT_PARALLEL_DOWNLOADS } from "./constants.ts";
export { ResolverError } from "./errors.ts";
export type { ResolverErrorCode } from "./errors.ts";
export { classifyDependencyRef } from "./classify.ts";
export { resolveDependencyGraph } from "./resolveGraph.ts";
export { downloadPackages } from "./download.ts";
export { resolveAndLock } from "./resolveAndLock.ts";
export { normalizeRepoIdentity, toLockRepoUrl } from "./identity.ts";
export {
  createDefaultDownloader,
  createDefaultGitRemote,
  createDefaultTagLister,
} from "./defaults.ts";

export type {
  ClassifiedDependency,
  DependencyKind,
  DownloadArgs,
  DownloadPackageSpec,
  DownloadPackagesOptions,
  Downloader,
  FakeTag,
  GitRemote,
  ResolveAndLockOptions,
  ResolveAndLockResult,
  ResolveDependencyGraphOptions,
  ResolveGraphResult,
  ResolvePorts,
  ResolvedNode,
  TagLister,
} from "./types.ts";
