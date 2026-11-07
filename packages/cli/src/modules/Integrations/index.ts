/**
 * Integrations — manifest-declared host integration loading + empty runtime registry.
 *
 * Owns the object-map overrides and canonical `@b-apm/integration-*` fallback so
 * feature modules (Install, Compile) never import the app composition layer.
 */

export { createCliIntegrationRegistry } from "./registry.ts";

export {
  globalModuleRootForCliEntry,
  globalModuleRoots,
  loadIntegrationFromPackage,
  ManifestIntegrationLoadError,
  registerManifestIntegrations,
  registerManifestIntegrationsFromCwd,
} from "./loadManifestIntegrations.ts";

export type {
  LoadIntegrationOptions,
  ManifestIntegrationLoadCause,
} from "./loadManifestIntegrations.ts";

export { isLocalPathSpecifier, resolveContainedLocalPath } from "./localPathSpecifier.ts";
