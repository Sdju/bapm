/** Shared option bags for Marketplace public APIs. */

export type MarketplaceConfigOptions = {
  /** Override config root (defaults to `~/.bapm`). */
  configDir?: string;
};

export type MarketplaceFetchOptions = MarketplaceConfigOptions & {
  forceRefresh?: boolean;
  /** Injectable HTTP transport (tests / custom clients). */
  fetch?: typeof globalThis.fetch;
};

export type MarketplaceSourceInit = {
  name: string;
  url?: string;
  ref?: string;
  path?: string;
  owner?: string;
  repo?: string;
  host?: string;
  branch?: string;
};

export type MarketplaceSourceKind = "local" | "url" | "github" | "gitlab" | "ado" | "git";

export type ValidationResult = {
  checkName: string;
  passed: boolean;
  warnings: string[];
  errors: string[];
};
