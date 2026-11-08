/**
 * Cache — modules-cache root info / clean helpers (project `apm_modules`).
 *
 * ## Public API
 *
 * - `cacheInfo` / `getCacheInfo` / `modulesCacheInfo`
 * - `cacheClean` / `cleanModulesCache` — project modules-cache only
 * - `sharedGitCacheInfo`, `sharedGitCacheClean` — opt-in shared mirror cache
 * - `sharedHttpCacheInfo`, `sharedHttpCacheClean` — opt-in shared HTTP cache
 * - `pruneSharedCache`, `pruneSharedHttpCache` — age-based shared cleanup
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
  SharedHttpCacheCleanOptions,
  SharedHttpCacheCleanResult,
  SharedHttpCacheConfig,
  SharedHttpCacheHit,
  SharedHttpCacheInfoOptions,
  SharedHttpCacheInfoResult,
  SharedHttpCacheLookupResult,
  SharedHttpCacheMiss,
  SharedHttpCacheMissReason,
  SharedHttpCacheOverride,
  SharedHttpCachePruneCandidate,
  SharedHttpCachePruneFailure,
  SharedHttpCachePruneOptions,
  SharedHttpCachePruneResult,
  SharedHttpCacheReason,
  SharedHttpCacheRequest,
  SharedHttpCacheResponse,
  SharedHttpCacheStoreReason,
  SharedHttpCacheStoreResult,
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

export {
  BAPM_HTTP_CACHE_ENV,
  BAPM_HTTP_CACHE_TTL_ENV,
  DEFAULT_SHARED_HTTP_PRUNE_DAYS,
  DEFAULT_SHARED_HTTP_TTL_SECONDS,
  SHARED_HTTP_CACHE_SUBDIR,
  isSharedHttpCacheableRequest,
  lookupSharedHttpCache,
  pruneSharedHttpCache,
  resolveSharedHttpCacheConfig,
  sharedHttpCacheClean,
  sharedHttpCacheInfo,
  sharedHttpCacheKey,
  storeSharedHttpCache,
} from "@/modules/SharedCache";
