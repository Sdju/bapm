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

/** Identity + inspect meta for a lock package in why output. */
export type DepsWhyPackage = {
  name?: string;
  repo_url?: string;
  version: string;
  source: string;
  is_direct: boolean;
};

/** One node in a why path chain (root → target). */
export type DepsWhyPathNode = {
  name?: string;
  repo_url?: string;
  constraint: string | null;
  is_direct: boolean;
};

export type DepsWhyPath = {
  chain: DepsWhyPathNode[];
};

export type DepsWhyError = "no_lockfile" | "not_installed" | "ambiguous";

export type DepsWhyResult = {
  ok: boolean;
  exitCode: number;
  chains: string[][];
  text: string;
  package?: DepsWhyPackage;
  paths?: DepsWhyPath[];
  error?: DepsWhyError;
  query?: string;
  matches?: Array<{ name?: string; repo_url?: string }>;
};
