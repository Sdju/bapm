/** Ambient types for marketplace-output packages that ship JS-only dist. */
declare module "@b-apm/integration-claude" {
  export const claudeMarketplaceIntegration: {
    id: string;
    marketplaceOutput: {
      format: string;
      defaultOutput: string;
      map: (config: unknown, resolved: unknown[]) => Record<string, unknown>;
    };
  };
  export function mapClaudeMarketplace(
    config: unknown,
    resolved: unknown[],
  ): Record<string, unknown>;
}

declare module "@b-apm/integration-codex" {
  export const codexMarketplaceIntegration: {
    id: string;
    marketplaceOutput: {
      format: string;
      defaultOutput: string;
      map: (config: unknown, resolved: unknown[]) => Record<string, unknown>;
    };
  };
  export function mapCodexMarketplace(
    config: unknown,
    resolved: unknown[],
  ): Record<string, unknown>;
}
