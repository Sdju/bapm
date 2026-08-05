/** Declared lock dependency entry (OpenAPM §5 / APM LockedDependency wire). */
export type LockedDependency = {
  repo_url: string;
  materialization_repo_url?: string;
  name?: string;
  version?: string;
  source?: string;
  resolved_commit?: string;
  /** Pin identity used for resolve / outdated tip (branch, tag, SHA, or HEAD). */
  resolved_ref?: string;
  resolved_url?: string;
  resolved_hash?: string;
  virtual_path?: string;
  constraint?: string;
  resolved_tag?: string;
  resolved_at?: string;
  tree_sha256?: string;
  deployed_files?: string[];
  deployed_file_hashes?: Record<string, string>;
  [key: string]: unknown;
};

/**
 * In-memory lockfile document. Known fields are typed; unknown top-level and
 * `x-*` keys (incl. deployments / lsp_* / MCP lists) are retained for round-trip.
 */
export type LockfileDocument = {
  lockfile_version: "1" | "2";
  dependencies: LockedDependency[];
  generated_at?: string;
  apm_version?: string | number;
  local_deployed_files?: string[];
  local_deployed_file_hashes?: Record<string, string>;
  [key: string]: unknown;
};

export type LockFilename = string;

/**
 * Loose document bag accepted by serialize/write/equivalence (acceptance helpers
 * extract via `lockOf()` as `Record<string, unknown>`).
 */
export type LockfileInput = LockfileDocument | Record<string, unknown>;

export type DiscoverLockfileOptions = {
  /** Project root; defaults to `process.cwd()`. No parent walk-up. */
  cwd?: string;
  /** Explicit lockfile path; wins over discovery. */
  path?: string;
};

export type DiscoveredLockfile = {
  path: string;
  /** Basename of the resolved file (`apm.lock.yaml` / `bapm.lock.yaml`, or explicit). */
  filename: string;
};

export type LoadLockfileOptions = DiscoverLockfileOptions;

export type LoadLockfileResult = {
  /** Validated document retaining unknown / `x-*` keys. */
  document: LockfileDocument;
  sourcePath: string;
  sourceFilename: string;
};

export type WriteLockfileOptions = {
  cwd?: string;
  /** Explicit destination path (overrides write-back / fresh default). */
  path?: string;
  /** Loaded filename for same-brand write-back. */
  sourceFilename?: string;
  /** Absolute path that was loaded; preferred write-back target. */
  sourcePath?: string;
};
