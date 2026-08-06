/**
 * Marketplace — consumer registry models, local CRUD, fetch/cache, thin validate.
 *
 * Orthogonal to Registry HTTP (package registry). Config root: `~/.bapm`.
 */

export {
  MarketplaceError,
  MarketplaceNotFoundError,
  MarketplaceFetchError,
  MarketplacePluginNotFoundError,
  MarketplaceUnsupportedSourceError,
} from "./errors.ts";

export type {
  MarketplaceConfigOptions,
  MarketplaceFetchOptions,
  MarketplaceSourceInit,
  MarketplaceSourceKind,
  ValidationResult,
} from "./types.ts";

export {
  getBapmConfigDir,
  marketplacesJsonPath,
  marketplaceCacheDir,
  ensureBapmConfigDir,
} from "./paths.ts";

export {
  MarketplaceSource,
  createMarketplaceSource,
  createMarketplacePlugin,
  createMarketplaceManifest,
  urlNamesRemoteManifest,
  resolveLocalFilesystemPath,
  type MarketplacePlugin,
  type MarketplaceManifest,
} from "./models.ts";

export { parseMarketplaceJson } from "./parse.ts";

export { listMarketplaces, getMarketplace, addMarketplace, removeMarketplace } from "./registry.ts";

export {
  CACHE_TTL_SECONDS,
  sanitizeCacheName,
  cacheKeyForSource,
  readMarketplaceCache,
  writeMarketplaceCache,
} from "./cache.ts";

export {
  MAX_MARKETPLACE_JSON_BYTES,
  MARKETPLACE_PATHS,
  fetchMarketplace,
  clearMarketplaceCache,
  autoDetectMarketplacePath,
} from "./fetch.ts";

export { validateMarketplace } from "./validate.ts";

export {
  parseMarketplaceRef,
  resolveMarketplacePlugin,
  type ParsedMarketplaceRef,
  type MarketplaceProvenance,
  type MarketplaceConcreteDep,
  type MarketplacePluginResolution,
  type ResolveMarketplacePluginOptions,
} from "./resolver.ts";
