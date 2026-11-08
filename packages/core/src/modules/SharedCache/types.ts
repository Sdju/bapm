/**
 * Opt-in shared git mirror cache (APM `cache/git_cache.py` inspiration).
 *
 * Enabled only when `BAPM_CACHE_DIR` is set; `BAPM_NO_CACHE=1` disables use
 * even when a cache directory is configured. Default behavior (no env) is
 * unchanged: downloads go straight into the project modules cache.
 */

export type SharedCacheEnv = Record<string, string | undefined>;

export type SharedGitCacheReason = "enabled" | "env-unset" | "no-cache";

export type SharedGitCacheConfig = {
  /** True only when a cache dir is configured and `BAPM_NO_CACHE` is off. */
  enabled: boolean;
  /** Resolved shared cache root (`BAPM_CACHE_DIR`), when configured. */
  cacheDir?: string;
  /** Bare-mirror root: `<cacheDir>/git`. */
  gitDir?: string;
  /** True when `BAPM_NO_CACHE=1` (or equivalent) suppressed use. */
  disabledByNoCache: boolean;
  reason: SharedGitCacheReason;
};

export type SharedGitCacheOverride = {
  env?: SharedCacheEnv;
  /** Explicit cache root; overrides `BAPM_CACHE_DIR` for tests/tools. */
  cacheDir?: string;
  /** Explicit disable; overrides `BAPM_NO_CACHE` for tests/tools. */
  noCache?: boolean;
};

export type SharedGitMirrorEntry = {
  /** Mirror directory name (`<sha256(identity)>.git`). */
  name: string;
  path: string;
  sizeBytes: number;
};

export type SharedGitCacheInfoOptions = SharedGitCacheOverride;

export type SharedGitCacheInfoResult = {
  enabled: boolean;
  cacheDir?: string;
  gitDir?: string;
  reason: SharedGitCacheReason;
  disabledByNoCache: boolean;
  exists: boolean;
  /** Number of mirror directories found. */
  mirrors: number;
  entries: number;
  sizeBytes: number;
  empty: boolean;
  mirrorPaths: string[];
  text: string;
};

export type SharedGitCacheCleanOptions = SharedGitCacheOverride & {
  yes?: boolean;
  y?: boolean;
  /** Default true: refuse without `yes` (non-interactive surfaces). */
  requireYes?: boolean;
  dryRun?: boolean;
};

export type SharedGitCacheCleanResult = {
  ok: boolean;
  cleaned: boolean;
  enabled: boolean;
  cacheDir?: string;
  gitDir?: string;
  removedEntries: number;
  message: string;
  refused?: boolean;
};
