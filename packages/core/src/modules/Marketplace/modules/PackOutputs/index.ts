/**
 * Marketplace PackOutputs — resolve authoring packages, map Claude/Codex JSON,
 * path-jail, atomic multi-output write during `bapm pack`.
 *
 * Fractal submodule of Marketplace (not a top-level module).
 */

export { MarketplacePackOutputsError } from "./errors.ts";

export type {
  MarketplaceOutputFormat,
  ResolvedPackage,
  LsRemoteResult,
  LsRemoteFn,
  BuildMarketplaceOutputsOptions,
  MarketplaceOutputWritten,
  BuildMarketplaceOutputsResult,
  ResolveMarketplacePackagesOptions,
  ResolveMarketplacePackagesResult,
} from "./types.ts";

export {
  MARKETPLACE_OUTPUT_PROFILES,
  KNOWN_OUTPUT_FORMATS,
  ensureMarketplacePathWithin,
  resolveEffectiveOutputPath,
  resolveMarketplaceOutputPath,
  formatsEnabledInConfig,
  parseMarketplaceFilter,
  selectOutputFormats,
  normalizeMarketplacePathOverrides,
  type MarketplaceOutputProfile,
  type ResolveEffectiveOutputPathOptions,
  type ParseMarketplaceFilterResult,
} from "./profiles.ts";

export {
  resolveMarketplacePackages,
  resolveAuthoringPackages,
  resolveMarketplacePackPackages,
} from "./resolve.ts";

export {
  mapClaudeMarketplace,
  mapCodexMarketplace,
  serializeMarketplaceJson,
} from "./mappers.ts";

export { atomicWriteMarketplaceJson } from "./write.ts";

export {
  buildMarketplaceOutputs,
  emitMarketplacePackOutputs,
  runMarketplaceBuilder,
  writeMarketplacePackOutputs,
  tryLoadMarketplaceAuthoring,
} from "./build.ts";
