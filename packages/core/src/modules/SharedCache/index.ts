/**
 * SharedCache — opt-in shared bare git mirror + HTTP response cache.
 *
 * Enabled by `BAPM_CACHE_DIR`; `BAPM_NO_CACHE=1` disables use. Git layout:
 * `<BAPM_CACHE_DIR>/git/<sha256(normalized repo url)>.git`. HTTP layout:
 * `<BAPM_CACHE_DIR>/http/<sha256(url + headers)>` (GET 200 only).
 *
 * ## Public API
 *
 * - `resolveSharedGitCacheConfig` / `resolveSharedHttpCacheConfig` — env gates
 * - `isCacheableGitRepoUrl`, `isSharedHttpCacheableRequest`
 * - `ensureSharedGitMirror`, `materializeSharedGitCheckout` — downloader helpers
 * - `lookupSharedHttpCache`, `storeSharedHttpCache` — registry transport helpers
 * - `sharedGitCacheInfo`, `sharedGitCacheClean` — git size/path info and wipe
 * - `sharedHttpCacheInfo`, `sharedHttpCacheClean` — HTTP size/path info and wipe
 * - `pruneSharedCache`, `pruneSharedHttpCache` — age-based cleanup
 *
 * ## Example
 *
 * ```ts
 * import { sharedGitCacheInfo } from "@/modules/SharedCache";
 * console.log(sharedGitCacheInfo().text);
 * ```
 */

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
} from "./types.ts";

export {
  BAPM_CACHE_DIR_ENV,
  BAPM_NO_CACHE_ENV,
  DEFAULT_SHARED_GIT_PRUNE_DAYS,
  SHARED_GIT_CACHE_SUBDIR,
  ensureSharedGitMirror,
  isCacheableGitRepoUrl,
  materializeSharedGitCheckout,
  pruneSharedCache,
  resolveSharedGitCacheConfig,
  sharedGitCacheClean,
  sharedGitCacheInfo,
  sharedGitMirrorName,
} from "./gitCache.ts";

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
} from "./httpCache.ts";
