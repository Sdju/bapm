export type SelfUpdateOptions = {
  args?: string[];
  cwd?: string;
};

export type SelfUpdateResult = {
  ok: boolean;
  message?: string;
  exitCode?: number;
};

export type SelfUpdateDeps = {
  name: string;
  getVersion: () => string;
  checkSelfUpdate: (options: {
    currentVersion?: string;
    registryUrl?: string;
    packageName?: string;
  }) => Promise<{
    currentVersion: string;
    latestVersion?: string;
    updateAvailable: boolean;
    unknownVersion: boolean;
    message: string;
  }>;
  /** Optional upgrade runner for bare `self-update` (SHOULD). */
  runUpgrade?: (latestVersion: string) => Promise<void>;
};
