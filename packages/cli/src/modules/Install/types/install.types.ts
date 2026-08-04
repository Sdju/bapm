export interface InstallDeps {
  name: string;
  manifestFile: string;
  lockFile: string;
}

export interface InstallOptions {
  args: string[];
  cwd?: string;
  /** Optional env for CI-default frozen resolution (defaults to `process.env`). */
  env?: Record<string, string | undefined>;
}

export interface InstallResult {
  ok: boolean;
  message?: string;
}
