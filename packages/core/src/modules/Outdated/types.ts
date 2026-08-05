import type { GitRemote, TagLister } from "@/modules/Resolver";

export type OutdatedStatus = "outdated" | "up-to-date" | "unknown";

export type OutdatedRow = {
  name: string;
  status: OutdatedStatus;
  current?: string;
  latest?: string;
  repo_url?: string;
  /** Tip ref used for the check (verbose / diagnostics). */
  tip_ref?: string;
  /** Skip / path reason when verbose. */
  detail?: string;
};

export type RunOutdatedOptions = {
  cwd?: string;
  gitRemote?: GitRemote;
  tagLister?: TagLister;
  /** Richer human-readable detail (chosen tip, skip reasons, candidates). */
  verbose?: boolean;
};

export type OutdatedResult = {
  ok: boolean;
  exitCode: number;
  rows: OutdatedRow[];
  text: string;
  message?: string;
};
