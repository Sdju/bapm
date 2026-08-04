export type RunUninstallOptions = {
  cwd?: string;
  packages?: string[];
  names?: string[];
  dryRun?: boolean;
  "dry-run"?: boolean;
};

export type UninstallResult = {
  ok: boolean;
  exitCode: number;
  dryRun: boolean;
  removed: string[];
  text: string;
  plan?: string[];
};
