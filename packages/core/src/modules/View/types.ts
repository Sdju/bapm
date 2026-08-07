export type ViewPackageOptions = {
  cwd?: string;
  package?: string;
  name?: string;
  query?: string;
};

export type ViewIdentity = {
  name?: string;
  repo_url?: string;
};

export type ViewError = "no_lockfile" | "not_installed" | "ambiguous";

export type ViewPackageResult = {
  ok: boolean;
  exitCode: number;
  text: string;
  identity?: ViewIdentity;
  /** Pin string: version → resolved_ref → resolved_tag → short commit. */
  version?: string;
  pin?: string;
  modulesPath?: string;
  summary?: string;
  error?: ViewError;
  query?: string;
  matches?: Array<{ name?: string; repo_url?: string }>;
};
