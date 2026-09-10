export type AdmittedCopilotNativePlugin = {
  /** Portable plugin.json name (enable key prefix). */
  pluginName: string;
  /** Package / lock identity name. */
  packageName: string;
  /** Absolute package root under apm_modules (or source). */
  packageRoot: string;
  /** Repo-relative path under apm_modules/ for catalog entries. */
  packagePathRel: string;
  /** Resolver depth (1 = direct). */
  depth: number;
  identity?: string;
};

export type CopilotNativeLedgerPlugin = {
  packageName: string;
  packagePath: string;
  identity?: string;
};

export type CopilotNativeLedger = {
  version: number;
  marketplaceId: string;
  modulesPath: string;
  ownedMarketplace: true;
  plugins: Record<string, CopilotNativeLedgerPlugin>;
};

export type RebuildCopilotNativeRegistrationOptions = {
  cwd: string;
  admitted: AdmittedCopilotNativePlugin[];
  dryRun?: boolean;
};

export type SyncCopilotNativeRegistrationOptions = {
  cwd: string;
  dryRun?: boolean;
};
