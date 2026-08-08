import type { MarketplaceAuthoringConfig, PackageEntry } from "../Authoring/types.ts";
import type { MarketplaceOutputRegistry } from "@bapm/integration-api";

/** Supported host marketplace output formats. */
export type MarketplaceOutputFormat = string;

/** Package after ref resolution (local pass-through or remote sha). */
export type ResolvedPackage = {
  name: string;
  /** Repository path without host (`owner/repo`) or local `./…` source. */
  sourceRepo: string;
  /** Original authoring source string. */
  source: string;
  subdir?: string;
  /** Concrete ref (tag / branch / sha short-name). */
  ref?: string;
  /** 40-char git SHA when remote. */
  sha?: string;
  requestedVersion?: string;
  tags: string[];
  isLocal: boolean;
  isPrerelease: boolean;
  host?: string;
  sourceUrl?: string;
  effectiveTagPattern?: string;
  category?: string;
  entry: PackageEntry;
};

export type LsRemoteResult = {
  sha: string;
  /** Ref name that matched (e.g. `refs/tags/v1.0.0` stripped or as given). */
  ref: string;
};

export type LsRemoteFn = (
  repoUrl: string,
  ref?: string,
) => Promise<LsRemoteResult> | LsRemoteResult;

export type BuildMarketplaceOutputsOptions = {
  cwd?: string;
  /** Authoring config path override. */
  path?: string;
  /**
   * CLI `--marketplace` filter:
   * - `undefined` / `"all"` — all enabled outputs from config
   * - `"none"` — skip emit
   * - comma list or string[] — only named formats
   */
  marketplace?: string | string[];
  /** CLI `--marketplace-path FORMAT=PATH` overrides. */
  marketplacePaths?: Record<string, string> | Array<string | { format: string; path: string }>;
  dryRun?: boolean;
  offline?: boolean;
  includePrerelease?: boolean;
  /** Injectable ls-remote for tests. */
  lsRemote?: LsRemoteFn;
  /** Pre-loaded config (skips detect/load). */
  config?: MarketplaceAuthoringConfig;
  /** Registered host-owned marketplace output capabilities. */
  marketplaceOutputs?: MarketplaceOutputRegistry;
};

export type MarketplaceOutputWritten = {
  format: MarketplaceOutputFormat;
  path: string;
  dryRun: boolean;
};

export type BuildMarketplaceOutputsResult = {
  ok: true;
  success: true;
  dryRun: boolean;
  skipped: boolean;
  packages: ResolvedPackage[];
  resolved: ResolvedPackage[];
  written: MarketplaceOutputWritten[];
  warnings: string[];
};

export type ResolveMarketplacePackagesOptions = {
  cwd?: string;
  path?: string;
  offline?: boolean;
  includePrerelease?: boolean;
  lsRemote?: LsRemoteFn;
  config?: MarketplaceAuthoringConfig;
};

export type ResolveMarketplacePackagesResult = {
  packages: ResolvedPackage[];
  resolved: ResolvedPackage[];
};
