export type RunPruneOptions = {
  cwd?: string;
  dryRun?: boolean;
  "dry-run"?: boolean;
};

export type PruneResult = {
  ok: boolean;
  exitCode: number;
  dryRun: boolean;
  orphans: string[];
  removed: string[];
  text: string;
};
