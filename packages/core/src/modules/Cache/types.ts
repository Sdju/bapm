import type { SharedGitCacheInfoResult } from "@/modules/SharedCache";

export type CacheInfoOptions = {
  cwd?: string;
  /** Override modules-cache root (default: `<cwd>/apm_modules`). */
  cacheRoot?: string;
  /** Env for shared-cache reporting (default: `process.env`). */
  env?: Record<string, string | undefined>;
};

export type CacheInfoResult = {
  cacheRoot: string;
  exists: boolean;
  entries: number;
  sizeBytes: number;
  empty: boolean;
  text: string;
  /** Shared git-cache stats; present even when the shared cache is disabled. */
  shared?: SharedGitCacheInfoResult;
};

export type CacheCleanOptions = {
  cwd?: string;
  cacheRoot?: string;
  /** Proceed without confirmation (`-y`). */
  yes?: boolean;
  /** Alias for yes. */
  y?: boolean;
  /**
   * When true and `yes` is false, refuse to delete (non-interactive).
   * Default true — callers must pass yes or confirm.
   */
  requireYes?: boolean;
  /**
   * Preview wipe: list would-remove entries, never delete, skip yes-refuse.
   * `removedEntries` is the would-remove count; `cleaned` stays false.
   */
  dryRun?: boolean;
};

export type CacheCleanResult = {
  ok: boolean;
  cleaned: boolean;
  cacheRoot: string;
  removedEntries: number;
  message: string;
  refused?: boolean;
};
