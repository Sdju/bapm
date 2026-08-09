import { createIntegrationRegistry } from "@bapm/integration-api";

/**
 * Empty runtime registry — hosts register via `registerManifestIntegrationsFromCwd`
 * (object-map overrides + canonical `@bapm/integration-*` fallback), not eager imports.
 */
export function createCliIntegrationRegistry() {
  return createIntegrationRegistry();
}
