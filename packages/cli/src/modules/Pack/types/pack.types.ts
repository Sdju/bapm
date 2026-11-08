export interface PackDeps {
  name: string;
  runPack: (options: {
    cwd?: string;
    agentPlugins?: boolean;
    format?: string;
    archive?: boolean;
    dryRun?: boolean;
    checkRelease?: boolean;
    checkVersions?: boolean;
    checkClean?: boolean;
    strictMetadata?: boolean;
    tag?: string;
    marketplace?: string | string[];
    marketplacePaths?: Record<string, string> | string[];
    offline?: boolean;
    includePrerelease?: boolean;
  }) => Promise<{
    archivePath?: string;
    ok?: boolean;
    marketplaceWritten?: boolean;
    checkClean?: {
      ok: boolean;
      skipped: boolean;
      outputs: Array<{
        format: string;
        path: string;
        status: string;
        differences: Array<{ path: string; old: unknown; new: unknown }>;
      }>;
    };
  }>;
  checkReleaseTag: (options: {
    cwd?: string;
    tag?: string;
  }) => Promise<{ ok?: boolean; warnings?: string[] }>;
  /** Required when `--check-versions` is used. */
  checkVersionAlignment?: (options: {
    config: unknown;
    cwd?: string;
    projectRoot?: string;
    root?: string;
  }) => {
    ok: boolean;
    strategy: string;
    expected: string | null;
    packages: Array<{
      path: string;
      version: string | null;
      ok: boolean;
      reason: string;
      error?: string;
    }>;
  };
  loadMarketplaceAuthoringConfig?: (options: { cwd?: string }) => {
    config: unknown;
    path?: string;
  };
  detectAuthoringConfigSource?: (options: { cwd?: string }) => {
    ok: boolean;
    kind: string;
    message?: string;
    error?: string;
  };
  versionAlignmentErrorMessages?: (report: {
    packages: Array<{ path: string; version: string | null; ok: boolean; reason: string }>;
  }) => string[];
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
  /** Prefer APM-like 3 for version-alignment failure; else omit (CLI uses 1). */
  exitCode?: number;
}
