export type RunPackOptions = {
  cwd?: string;
  /** Pack an Agent Plugins v1 portable root (never a marketplace output). */
  agentPlugins?: boolean;
  /** Produce a durable archive (MUST path for M7). */
  archive?: boolean;
  /** Archive format; only `zip` is supported in M7. */
  format?: "zip" | string;
  /** Validate and collect without writing a durable artifact. */
  dryRun?: boolean;
  /** Explicit output zip path; defaults to `{name}-{version}.zip` under cwd. */
  outputPath?: string;
  /** Also run pr-004 release gate before packing. */
  checkRelease?: boolean;
  /** Tag override for `--check-release`. */
  tag?: string;
  /**
   * CLI `--marketplace` filter: `all` | `none` | comma list / string[].
   * When omitted, emit all formats enabled in authoring `outputs`.
   */
  marketplace?: string | string[] | "all" | "none";
  /** CLI `--marketplace-path FORMAT=PATH` overrides. */
  marketplacePaths?: Record<string, string> | string[];
  /** Fail-closed remote resolve without network. */
  offline?: boolean;
  /** Include prerelease tags when resolving version ranges. */
  includePrerelease?: boolean;
  /** Injectable ls-remote for tests (forwarded to marketplace builder). */
  lsRemote?: (
    repoUrl: string,
    ref?: string,
  ) =>
    | Promise<{ sha: string; ref: string }>
    | {
        sha: string;
        ref: string;
      };
};

export type RunPackResult = {
  ok: true;
  dryRun: boolean;
  archivePath?: string;
  filesPacked: number;
  marketplaceWritten?: boolean;
};

export type ExtractPackArchiveOptions = {
  /** Absolute or relative path to the zip archive. */
  archivePath?: string;
  /** Alias for `archivePath`. */
  path?: string;
  /** Project / extract root (aliases: `outputDir`, `dest`). */
  cwd?: string;
  outputDir?: string;
  dest?: string;
};

export type ExtractPackArchiveResult = {
  ok: true;
  outputDir: string;
  filesExtracted: number;
};

export type CheckReleaseTagOptions = {
  cwd?: string;
  /** Explicit release tag (optional leading `v`). */
  tag?: string;
  /**
   * When true, treat the tag as unsigned for pr-005 advisory.
   * MUST NOT fail solely for unsigned in M7.
   */
  unsigned?: boolean;
  /** Hard-require signature — ignored as fail condition in M7 (advisory only). */
  requireSignature?: boolean;
};

export type CheckReleaseTagResult = {
  ok: true;
  exitCode: 0;
  tag: string;
  version: string;
  warnings: string[];
};
