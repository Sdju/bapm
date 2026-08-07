import { createIntegrationRegistry } from "@bapm/integration-api";
import { createCursorIntegration } from "@bapm/integration-cursor";

/** Register the integration packages shipped with the CLI distribution. */
export function createCliIntegrationRegistry() {
  const registry = createIntegrationRegistry();
  registry.register(createCursorIntegration());
  return registry;
}
