import type { GitRemote, TagLister } from "@/modules/Resolver";

export type OutdatedStatus = "outdated" | "up-to-date" | "unknown";

export type OutdatedRow = {
  name: string;
  status: OutdatedStatus;
  current?: string;
  latest?: string;
  repo_url?: string;
};

export type RunOutdatedOptions = {
  cwd?: string;
  gitRemote?: GitRemote;
  tagLister?: TagLister;
};

export type OutdatedResult = {
  ok: boolean;
  exitCode: number;
  rows: OutdatedRow[];
  text: string;
  message?: string;
};
