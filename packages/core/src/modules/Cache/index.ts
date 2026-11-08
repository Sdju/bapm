/**
 * Cache — modules-cache root info / clean helpers (project `apm_modules`).
 *
 * ## Public API
 *
 * - `cacheInfo` / `getCacheInfo` / `modulesCacheInfo`
 * - `cacheClean` / `cleanModulesCache` — project modules-cache only
 * - `sharedGitCacheInfo`, `sharedGitCacheClean` — opt-in shared mirror cache
 * - `pruneSharedCache` — remove shared mirrors older than N days
 *
 * ## Example
 *
 * ```ts
 * import { cacheInfo, cacheClean } from "@/modules/Cache";
 * const info = cacheInfo({ cwd });
 * cacheClean({ cwd, yes: true });
 * ```
 */

export type {
  CacheCleanOptions,
  CacheCleanResult,
  CacheInfoOptions,
  CacheInfoResult,
} from "./types.ts";

export {
  cacheInfo,
  getCacheInfo,
  modulesCacheInfo,
  cacheClean,
  cleanModulesCache,
} from "./cacheOps.ts";

export type {
  SharedCacheEnv,
  SharedGitCacheCleanOptions,
  SharedGitCacheCleanResult,
  SharedGitCacheConfig,
  SharedGitCacheInfoOptions,
  SharedGitCacheInfoResult,
  SharedGitCacheOverride,
  SharedGitCachePruneCandidate,
  SharedGitCachePruneFailure,
  SharedGitCachePruneOptions,
  SharedGitCachePruneResult,
  SharedGitCacheReason,
  SharedGitMirrorEntry,
} from "@/modules/SharedCache";

export {
  BAPM_CACHE_DIR_ENV,
  BAPM_NO_CACHE_ENV,
  DEFAULT_SHARED_GIT_PRUNE_DAYS,
  SHARED_GIT_CACHE_SUBDIR,
  isCacheableGitRepoUrl,
  pruneSharedCache,
  resolveSharedGitCacheConfig,
  sharedGitCacheClean,
  sharedGitCacheInfo,
  sharedGitMirrorName,
} from "@/modules/SharedCache";
