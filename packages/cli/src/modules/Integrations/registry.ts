import { createIntegrationRegistry } from "@b-apm/integration-api";

/**
 * Empty runtime registry — hosts register via `registerManifestIntegrationsFromCwd`
 * (object-map overrides + canonical `@b-apm/integration-*` fallback), not eager imports.
 */
export function createCliIntegrationRegistry() {
  return createIntegrationRegistry();
}
