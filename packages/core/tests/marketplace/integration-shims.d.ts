/** Ambient types for marketplace-output packages that ship JS-only dist. */
declare module "@bapm/integration-claude" {
  import type { MarketplaceOutputIntegration } from "@bapm/integration-api";
  export const claudeMarketplaceIntegration: MarketplaceOutputIntegration;
  export function mapClaudeMarketplace(
    config: unknown,
    resolved: unknown[],
  ): Record<string, unknown>;
}

declare module "@bapm/integration-codex" {
  import type { MarketplaceOutputIntegration } from "@bapm/integration-api";
  export const codexMarketplaceIntegration: MarketplaceOutputIntegration;
  export function mapCodexMarketplace(
    config: unknown,
    resolved: unknown[],
  ): Record<string, unknown>;
}
