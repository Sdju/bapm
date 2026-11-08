import type { Downloader, GitRemote, TagLister } from "@/modules/Resolver";

export type UpdatePlanEntry = {
  name: string;
  action: "update" | "add" | "remove" | "keep";
  from?: string;
  to?: string;
  /** Human-readable explanation (e.g. a mutable ref could not be resolved). */
  note?: string;
};

export type RunUpdateOptions = {
  cwd?: string;
  /** Apply without interactive confirm. */
  yes?: boolean;
  /** Plan only; no lock/modules mutation. */
  dryRun?: boolean;
  "dry-run"?: boolean;
  /** Frozen context — refuse without override. Defaults to CI-default frozen when omitted. */
  frozen?: boolean;
  /** Explicit override to allow update under frozen context (CLI `--force`). */
  force?: boolean;
  override?: boolean;
  /**
   * Env map used to resolve CI-default frozen when `frozen` is omitted.
   * Defaults to `process.env`; tests pass a stub (e.g. `{ CI: "true" }`).
   */
  env?: Record<string, string | undefined>;
  /** Package scope (rs-012). */
  packages?: string[];
  scope?: string[];
  updatePackageNames?: string[];
  gitRemote?: GitRemote;
  tagLister?: TagLister;
  downloader?: Downloader;
  parallelDownloads?: number;
  maxDepth?: number;
  /**
   * When true, plan text includes `keep` / `[=]` rows.
   * Default quiet: keep rows are omitted from printed text (plan array stays full).
   */
  verbose?: boolean;
  /** Injected confirm for TTY tests; return true to apply. */
  confirm?: () => boolean | Promise<boolean>;
  /** Whether stdin is a TTY (default: process.stdin.isTTY). */
  isTTY?: boolean;
  /** Explicit policy file path. */
  policyPath?: string;
  policy?: string;
  /** Full escape: skip policy gate (`--no-policy-all`). */
  noPolicy?: boolean;
  /** Skip only repository-local policy; org/remote policy still applies. */
  noRepoPolicy?: boolean;
};

export type UpdateResult = {
  ok: boolean;
  exitCode: number;
  dryRun: boolean;
  plan: UpdatePlanEntry[];
  text: string;
  lockPath?: string;
};
