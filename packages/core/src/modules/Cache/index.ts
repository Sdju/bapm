/**
 * Cache — modules-cache root info / clean helpers (project `apm_modules`).
 *
 * ## Public API
 *
 * - `cacheInfo` / `getCacheInfo` / `modulesCacheInfo`
 * - `cacheClean` / `cleanModulesCache`
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
