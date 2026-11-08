/**
 * @b-apm/integration-codex — Codex CLI runtime + marketplace pack mapper.
 */
export { createCodexIntegration, createCodexIntegration as createIntegration, } from "./createCodexIntegration.ts";
import type { MarketplaceOutputIntegration } from "@b-apm/integration-api";
/** Maps resolved packages into Codex's marketplace document. */
export declare function mapCodexMarketplace(config: unknown, resolved: unknown[]): Record<string, unknown>;
export declare const codexMarketplaceIntegration: MarketplaceOutputIntegration;
