/**
 * Marketplace — consumer registry models, local CRUD, fetch/cache, thin validate,
 * plus authoring (`bapm.yml` marketplace: block) via fractal Authoring submodule.
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

export {
  MarketplaceAuthoringError,
  validateMarketplaceAuthoringSource,
  isValidMarketplaceAuthoringSource,
  isLocalAuthoringSource,
  isGithubOwnerRepoShorthand,
  splitHostFromAuthoringSource,
  githubHttpsUrlFromOwnerRepo,
  loadMarketplaceFromBapmYml,
  loadMarketplaceFromLegacyYml,
  detectAuthoringConfigSource,
  loadMarketplaceAuthoringConfig,
  DEPRECATION_MESSAGE,
  renderMarketplaceBlock,
  renderInitMarketplaceBlock,
  createMarketplaceAuthoringTemplate,
  initMarketplaceAuthoring,
  addMarketplacePackage,
  setMarketplacePackage,
  removeMarketplacePackage,
  addAuthoringPackage,
  updateAuthoringPackage,
  removeAuthoringPackage,
  marketplacePackageAdd,
  marketplacePackageSet,
  marketplacePackageRemove,
  checkMarketplaceAuthoring,
  checkAuthoringMarketplace,
  runMarketplaceAuthoringCheck,
  migrateMarketplaceYml,
  migrateLegacyMarketplaceYml,
  runMarketplaceMigrate,
  type PackageEntry,
  type MarketplaceAuthoringConfig,
  type LoadMarketplaceResult,
  type DetectAuthoringConfigSourceResult,
  type CheckMarketplaceAuthoringResult,
  type MigrateMarketplaceYmlResult,
  type EditorResult,
  type SourceValidationResult,
} from "./modules/Authoring";

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

export {
  classifyMarketplaceHost,
  classifyMarketplaceHostKind,
  marketplaceKindFromHostClass,
  githubApiBaseForHost,
  isUnlockedMarketplaceHost,
  type MarketplaceHostClass,
} from "./hostClassify.ts";

export {
  resolveTokenForHost,
  resolveMarketplaceTokenForHost,
  resolveAuthTokenForHost,
  authHeadersForHost,
  type ResolvedMarketplaceToken,
} from "./resolveToken.ts";

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

export {
  MarketplacePackOutputsError,
  MARKETPLACE_OUTPUT_PROFILES,
  KNOWN_OUTPUT_FORMATS,
  ensureMarketplacePathWithin,
  resolveEffectiveOutputPath,
  resolveMarketplaceOutputPath,
  formatsEnabledInConfig,
  parseMarketplaceFilter,
  selectOutputFormats,
  normalizeMarketplacePathOverrides,
  resolveMarketplacePackages,
  resolveAuthoringPackages,
  resolveMarketplacePackPackages,
  mapClaudeMarketplace,
  mapCodexMarketplace,
  serializeMarketplaceJson,
  atomicWriteMarketplaceJson,
  buildMarketplaceOutputs,
  emitMarketplacePackOutputs,
  runMarketplaceBuilder,
  writeMarketplacePackOutputs,
  tryLoadMarketplaceAuthoring,
  type MarketplaceOutputFormat,
  type ResolvedPackage,
  type LsRemoteResult,
  type LsRemoteFn,
  type BuildMarketplaceOutputsOptions,
  type MarketplaceOutputWritten,
  type BuildMarketplaceOutputsResult,
  type ResolveMarketplacePackagesOptions,
  type ResolveMarketplacePackagesResult,
  type MarketplaceOutputProfile,
  type ResolveEffectiveOutputPathOptions,
  type ParseMarketplaceFilterResult,
} from "./modules/PackOutputs";
