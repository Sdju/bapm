export interface InstallDeps {
  name: string;
  manifestFile: string;
  lockFile: string;
}

export interface InstallOptions {
  args: string[];
}

export interface InstallResult {
  ok: boolean;
}
