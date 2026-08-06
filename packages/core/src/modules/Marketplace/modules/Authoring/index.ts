/**
 * Marketplace Authoring — bapm.yml `marketplace:` schema, editor, check, migrate.
 * Fractal submodule of Marketplace (not a top-level module).
 */

export { MarketplaceAuthoringError } from "./errors.ts";

export type {
  MarketplaceAuthoringOwner,
  MarketplaceAuthoringBuild,
  MarketplaceAuthoringOutputs,
  PackageEntry,
  MarketplaceAuthoringConfig,
  LoadMarketplaceFromBapmYmlOptions,
  LoadMarketplaceResult,
  DetectAuthoringConfigSourceOptions,
  DetectAuthoringConfigSourceResult,
  AuthoringPackageEditOptions,
  AuthoringPackageRemoveOptions,
  EditorResult,
  CheckMarketplaceAuthoringOptions,
  CheckMarketplaceAuthoringResult,
  MigrateMarketplaceYmlOptions,
  MigrateMarketplaceYmlResult,
  RenderMarketplaceBlockOptions,
} from "./types.ts";

export type { SourceValidationResult } from "./source.ts";

export {
  validateMarketplaceAuthoringSource,
  isValidMarketplaceAuthoringSource,
  isLocalAuthoringSource,
  isGithubOwnerRepoShorthand,
  splitHostFromAuthoringSource,
  githubHttpsUrlFromOwnerRepo,
} from "./source.ts";

export {
  loadMarketplaceFromBapmYml,
  loadMarketplaceFromLegacyYml,
} from "./load.ts";

export {
  detectAuthoringConfigSource,
  loadMarketplaceAuthoringConfig,
  DEPRECATION_MESSAGE,
} from "./detect.ts";

export {
  renderMarketplaceBlock,
  renderInitMarketplaceBlock,
  createMarketplaceAuthoringTemplate,
} from "./initTemplate.ts";

export {
  initMarketplaceAuthoring,
  type InitMarketplaceAuthoringOptions,
  type InitMarketplaceAuthoringResult,
} from "./init.ts";

export {
  addMarketplacePackage,
  setMarketplacePackage,
  removeMarketplacePackage,
  addAuthoringPackage,
  updateAuthoringPackage,
  removeAuthoringPackage,
  marketplacePackageAdd,
  marketplacePackageSet,
  marketplacePackageRemove,
} from "./editor.ts";

export {
  checkMarketplaceAuthoring,
  checkAuthoringMarketplace,
  runMarketplaceAuthoringCheck,
} from "./check.ts";

export {
  migrateMarketplaceYml,
  migrateLegacyMarketplaceYml,
  runMarketplaceMigrate,
} from "./migrate.ts";
