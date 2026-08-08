export interface PackDeps {
  name: string;
  runPack: (options: {
    cwd?: string;
    agentPlugins?: boolean;
    archive?: boolean;
    dryRun?: boolean;
    checkRelease?: boolean;
    tag?: string;
    marketplace?: string | string[];
    marketplacePaths?: Record<string, string> | string[];
    offline?: boolean;
    includePrerelease?: boolean;
  }) => Promise<{ archivePath?: string; ok?: boolean; marketplaceWritten?: boolean }>;
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
  marketplaceWritten?: boolean;
}
