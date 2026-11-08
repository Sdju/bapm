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

export type SharedGitCachePruneOptions = SharedGitCacheOverride & {
  /** Remove mirrors last modified/accessed more than this many days ago. */
  days?: number;
  /** Preview candidates without deleting anything. */
  dryRun?: boolean;
  /** Accepted for symmetry with destructive commands; prune is non-interactive. */
  yes?: boolean;
  y?: boolean;
  /** When true, refuse to delete without `yes`/`y`. Default false (APM parity). */
  requireYes?: boolean;
};

export type SharedGitCachePruneCandidate = {
  /** Mirror directory name relative to `<cacheDir>/git`. */
  name: string;
  path: string;
  ageDays: number;
  lastUsedMs: number;
};

export type SharedGitCachePruneFailure = {
  name: string;
  path: string;
  message: string;
};

export type SharedGitCachePruneResult = {
  ok: boolean;
  enabled: boolean;
  reason: SharedGitCacheReason;
  cacheDir?: string;
  gitDir?: string;
  /** Alias for `gitDir`; `null` is emitted by the CLI when cache is unset. */
  root?: string;
  days: number;
  dryRun: boolean;
  /** Candidate mirror names (relative to `root`). */
  candidates: string[];
  candidateDetails: SharedGitCachePruneCandidate[];
  pruned: number;
  failed: number;
  failures: SharedGitCachePruneFailure[];
  message: string;
  refused?: boolean;
};

/* -------------------------------------------------------------------------- */
/* Shared HTTP cache                                                          */
/* -------------------------------------------------------------------------- */

export type SharedHttpCacheReason = "enabled" | "env-unset" | "no-cache" | "http-cache-disabled";

export type SharedHttpCacheConfig = {
  /** True only when a cache dir is configured and neither bypass env is set. */
  enabled: boolean;
  /** Resolved shared cache root (`BAPM_CACHE_DIR`), when configured. */
  cacheDir?: string;
  /** HTTP entry root: `<cacheDir>/http`. */
  httpDir?: string;
  /** Freshness window in seconds (`BAPM_HTTP_CACHE_TTL`, default 300). */
  ttlSeconds: number;
  /** True when `BAPM_NO_CACHE=1` (or equivalent) suppressed use. */
  disabledByNoCache: boolean;
  /** True when `BAPM_HTTP_CACHE=0` (or equivalent) suppressed HTTP caching. */
  disabledByHttpCache: boolean;
  reason: SharedHttpCacheReason;
};

export type SharedHttpCacheOverride = {
  env?: SharedCacheEnv;
  /** Explicit cache root; overrides `BAPM_CACHE_DIR` for tests/tools. */
  cacheDir?: string;
  /** Explicit global disable; overrides `BAPM_NO_CACHE` for tests/tools. */
  noCache?: boolean;
  /** Explicit HTTP-cache switch; `false` overrides `BAPM_HTTP_CACHE` for tests. */
  httpCache?: boolean;
  /** Explicit TTL seconds; overrides `BAPM_HTTP_CACHE_TTL` for tests/tools. */
  ttlSeconds?: number;
};

export type SharedHttpCacheRequest = {
  method: string;
  url: string;
  headers?: Record<string, string>;
};

export type SharedHttpCacheResponse = {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array;
};

export type SharedHttpCacheHit = {
  hit: true;
  response: SharedHttpCacheResponse;
  /** Absolute entry path. */
  path: string;
  /** Age of the cached entry. */
  ageMs: number;
};

export type SharedHttpCacheMissReason =
  | SharedHttpCacheReason
  | "not-cacheable"
  | "miss"
  | "expired"
  | "malformed";

export type SharedHttpCacheMiss = {
  hit: false;
  reason: SharedHttpCacheMissReason;
  path?: string;
};

export type SharedHttpCacheLookupResult = SharedHttpCacheHit | SharedHttpCacheMiss;

export type SharedHttpCacheStoreReason =
  | SharedHttpCacheReason
  | "not-cacheable"
  | "not-200"
  | "write-error";

export type SharedHttpCacheStoreResult = {
  stored: boolean;
  path?: string;
  reason?: SharedHttpCacheStoreReason;
  message?: string;
};

export type SharedHttpCacheInfoOptions = SharedHttpCacheOverride;

export type SharedHttpCacheInfoResult = {
  enabled: boolean;
  cacheDir?: string;
  httpDir?: string;
  reason: SharedHttpCacheReason;
  ttlSeconds: number;
  disabledByNoCache: boolean;
  disabledByHttpCache: boolean;
  exists: boolean;
  entries: number;
  sizeBytes: number;
  empty: boolean;
  entryPaths: string[];
  text: string;
};

export type SharedHttpCacheCleanOptions = SharedHttpCacheOverride & {
  yes?: boolean;
  y?: boolean;
  /** Default true: refuse without `yes` (non-interactive surfaces). */
  requireYes?: boolean;
  dryRun?: boolean;
};

export type SharedHttpCacheCleanResult = {
  ok: boolean;
  cleaned: boolean;
  enabled: boolean;
  cacheDir?: string;
  httpDir?: string;
  removedEntries: number;
  message: string;
  refused?: boolean;
};

export type SharedHttpCachePruneOptions = SharedHttpCacheOverride & {
  /** Remove entries last modified/accessed more than this many days ago. */
  days?: number;
  /** Preview candidates without deleting anything. */
  dryRun?: boolean;
  /** Accepted for symmetry with destructive commands; prune is non-interactive. */
  yes?: boolean;
  y?: boolean;
  /** When true, refuse to delete without `yes`/`y`. Default false. */
  requireYes?: boolean;
};

export type SharedHttpCachePruneCandidate = {
  /** Entry file name relative to `<cacheDir>/http`. */
  name: string;
  path: string;
  ageDays: number;
  lastUsedMs: number;
};

export type SharedHttpCachePruneFailure = {
  name: string;
  path: string;
  message: string;
};

export type SharedHttpCachePruneResult = {
  ok: boolean;
  enabled: boolean;
  reason: SharedHttpCacheReason;
  cacheDir?: string;
  httpDir?: string;
  /** Alias for `httpDir`; `null` is emitted by the CLI when cache is unset. */
  root?: string;
  days: number;
  dryRun: boolean;
  /** Candidate entry names (relative to `root`). */
  candidates: string[];
  candidateDetails: SharedHttpCachePruneCandidate[];
  pruned: number;
  failed: number;
  failures: SharedHttpCachePruneFailure[];
  message: string;
  refused?: boolean;
};
