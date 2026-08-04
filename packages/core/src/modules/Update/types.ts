import type { Downloader, GitRemote, TagLister } from "@/modules/Resolver";

export type UpdatePlanEntry = {
  name: string;
  action: "update" | "add" | "remove" | "keep";
  from?: string;
  to?: string;
};

export type RunUpdateOptions = {
  cwd?: string;
  /** Apply without interactive confirm. */
  yes?: boolean;
  /** Plan only; no lock/modules mutation. */
  dryRun?: boolean;
  "dry-run"?: boolean;
  /** Frozen context — refuse without override. */
  frozen?: boolean;
  /** Explicit override to allow update under frozen (not used in M6 accept). */
  force?: boolean;
  override?: boolean;
  /** Package scope (rs-012). */
  packages?: string[];
  scope?: string[];
  updatePackageNames?: string[];
  gitRemote?: GitRemote;
  tagLister?: TagLister;
  downloader?: Downloader;
  parallelDownloads?: number;
  maxDepth?: number;
  /** Injected confirm for TTY tests; return true to apply. */
  confirm?: () => boolean | Promise<boolean>;
  /** Whether stdin is a TTY (default: process.stdin.isTTY). */
  isTTY?: boolean;
  /** Explicit policy file path. */
  policyPath?: string;
  policy?: string;
  /** Skip policy gate. */
  noPolicy?: boolean;
};

export type UpdateResult = {
  ok: boolean;
  exitCode: number;
  dryRun: boolean;
  plan: UpdatePlanEntry[];
  text: string;
  lockPath?: string;
};
