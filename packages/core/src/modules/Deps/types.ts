export type RunDepsOptions = {
  cwd?: string;
  package?: string;
  name?: string;
  packages?: string[];
};

export type DepsListResult = {
  ok: boolean;
  exitCode: number;
  packages: Array<Record<string, unknown>>;
  text: string;
};

export type DepsTreeResult = {
  ok: boolean;
  exitCode: number;
  tree: unknown;
  text: string;
};

export type DepsWhyResult = {
  ok: boolean;
  exitCode: number;
  chains: string[][];
  text: string;
};
