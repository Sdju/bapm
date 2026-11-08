/**
 * @b-apm/integration-claude — Claude Code runtime + marketplace pack mapper.
 */
export {
  createClaudeIntegration,
  createClaudeIntegration as createIntegration,
  transformClaudeRulesMarkdown,
} from "./createClaudeIntegration.ts";
import type { MarketplaceOutputIntegration } from "@b-apm/integration-api";
/** Maps resolved packages into Anthropic's marketplace document. */
export declare function mapClaudeMarketplace(
  config: unknown,
  resolved: unknown[],
): Record<string, unknown>;
export declare const claudeMarketplaceIntegration: MarketplaceOutputIntegration;
