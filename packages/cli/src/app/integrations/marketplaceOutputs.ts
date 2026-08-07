import { createMarketplaceOutputRegistry } from "bapm-integration-api";
import { claudeMarketplaceIntegration } from "bapm-integration-claude";
import { codexMarketplaceIntegration } from "bapm-integration-codex";

/** Register distribution-owned marketplace-output integrations. */
export function createCliMarketplaceOutputRegistry() {
  const registry = createMarketplaceOutputRegistry();
  registry.register(claudeMarketplaceIntegration);
  registry.register(codexMarketplaceIntegration);
  return registry;
}
