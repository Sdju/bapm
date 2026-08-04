export interface PackDeps {
  name: string;
  runPack: (options: {
    cwd?: string;
    archive?: boolean;
    dryRun?: boolean;
    checkRelease?: boolean;
    tag?: string;
  }) => Promise<{ archivePath?: string; ok?: boolean }>;
  checkReleaseTag: (options: {
    cwd?: string;
    tag?: string;
  }) => Promise<{ ok?: boolean; warnings?: string[] }>;
}

export interface PackOptions {
  args: string[];
  cwd?: string;
}

export interface PackResult {
  ok: boolean;
  message?: string;
  archivePath?: string;
}
