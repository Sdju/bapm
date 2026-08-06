/** Marketplace authoring types (bapm.yml `marketplace:` block). Separate from consumer JSON models. */

export type MarketplaceAuthoringOwner =
  | string
  | {
      name: string;
      url?: string;
      email?: string;
    };

export type MarketplaceAuthoringBuild = {
  tagPattern?: string;
};

export type MarketplaceAuthoringOutputs = Record<string, unknown>;

export type PackageEntry = {
  name: string;
  source: string;
  version?: string;
  ref?: string;
  subdir?: string;
  tag_pattern?: string;
  include_prerelease?: boolean;
  description?: string;
  homepage?: string;
  tags?: string[];
  author?: string | Record<string, string>;
  license?: string;
  repository?: string;
  keywords?: string[];
  category?: string;
  /** Derived: source begins with `./`. */
  isLocal: boolean;
  /** Snake alias for APM parity. */
  is_local: boolean;
};

export type MarketplaceAuthoringConfig = {
  name?: string;
  description?: string;
  version?: string;
  owner?: MarketplaceAuthoringOwner;
  sourceBase?: string;
  build?: MarketplaceAuthoringBuild;
  outputs?: MarketplaceAuthoringOutputs;
  /** Legacy single-output / pass-through keys retained when present. */
  output?: unknown;
  claude?: unknown;
  codex?: unknown;
  metadata?: Record<string, unknown>;
  versioning?: unknown;
  packages: PackageEntry[];
};

export type LoadMarketplaceFromBapmYmlOptions = {
  cwd?: string;
  path?: string;
};

export type LoadMarketplaceResult = {
  ok: true;
  config: MarketplaceAuthoringConfig;
  path: string;
  source: "bapm.yml" | "marketplace.yml";
};

export type DetectAuthoringConfigSourceOptions = {
  cwd?: string;
};

export type DetectAuthoringConfigSourceResult =
  | { kind: "bapm.yml"; ok: true; path: string }
  | { kind: "marketplace.yml"; ok: true; path: string }
  | { kind: "both"; ok: false; error: string }
  | { kind: "none"; ok: false; message: string; error: string };

export type AuthoringPackageEditOptions = {
  cwd?: string;
  path?: string;
  name: string;
  source?: string;
  version?: string;
  ref?: string;
  subdir?: string;
  tagPattern?: string;
  tag_pattern?: string;
  tags?: string[] | string;
  includePrerelease?: boolean;
  include_prerelease?: boolean;
  description?: string;
  category?: string;
  /** Skip git ls-remote verify on add. */
  noVerify?: boolean;
};

export type AuthoringPackageRemoveOptions = {
  cwd?: string;
  path?: string;
  name: string;
};

export type EditorResult = { ok: true; path: string } | { ok: false; error: string };

export type CheckMarketplaceAuthoringOptions = {
  cwd?: string;
  path?: string;
  offline?: boolean;
  /** Injectable ls-remote for tests. */
  lsRemote?: (repoUrl: string, ref?: string) => Promise<void> | void;
};

export type CheckMarketplaceAuthoringResult = {
  ok: boolean;
  exitCode: number;
  errors: string[];
  warnings: string[];
};

export type MigrateMarketplaceYmlOptions = {
  cwd?: string;
  dryRun?: boolean;
  force?: boolean;
  yes?: boolean;
};

export type MigrateMarketplaceYmlResult = {
  ok: boolean;
  dryRun: boolean;
  message?: string;
  error?: string;
};

export type RenderMarketplaceBlockOptions = {
  owner?: string;
  name?: string;
  cwd?: string;
};
