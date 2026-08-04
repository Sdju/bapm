export type CacheInfoOptions = {
  cwd?: string;
  /** Override modules-cache root (default: `<cwd>/apm_modules`). */
  cacheRoot?: string;
};

export type CacheInfoResult = {
  cacheRoot: string;
  exists: boolean;
  entries: number;
  sizeBytes: number;
  empty: boolean;
  text: string;
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
};

export type CacheCleanResult = {
  ok: boolean;
  cleaned: boolean;
  cacheRoot: string;
  removedEntries: number;
  message: string;
  refused?: boolean;
};
