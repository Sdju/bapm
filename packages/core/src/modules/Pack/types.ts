export type RunPackOptions = {
  cwd?: string;
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
};

export type RunPackResult = {
  ok: true;
  dryRun: boolean;
  archivePath?: string;
  filesPacked: number;
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
