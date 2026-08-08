import { createIntegrationRegistry } from "@bapm/integration-api";

/**
 * Empty runtime registry — hosts register only via object-map load
 * (`registerManifestIntegrationsFromCwd`), not eager composition-root imports.
 */
export function createCliIntegrationRegistry() {
  return createIntegrationRegistry();
}
