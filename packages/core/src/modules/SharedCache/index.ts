/**
 * SharedCache — opt-in shared bare git mirror cache.
 *
 * Enabled by `BAPM_CACHE_DIR`; `BAPM_NO_CACHE=1` disables use. Layout:
 * `<BAPM_CACHE_DIR>/git/<sha256(normalized repo url)>.git`.
 *
 * ## Public API
 *
 * - `resolveSharedGitCacheConfig` — env/config gate
 * - `isCacheableGitRepoUrl` — never cache local paths / `file://` / `local:`
 * - `ensureSharedGitMirror`, `materializeSharedGitCheckout` — downloader helpers
 * - `sharedGitCacheInfo`, `sharedGitCacheClean` — size/path info and mirror wipe
 * - `pruneSharedCache` — remove mirrors older than `--days` (default 30)
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
