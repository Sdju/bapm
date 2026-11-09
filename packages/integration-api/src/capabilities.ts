/**
 * Shared capability defaults for registered integrations.
 */

import type { BapmIntegration, McpEnvMode } from "./types.ts";

export type IntegrationCapabilities = {
  mcpEnvMode: McpEnvMode;
  mcpHeadersEnvMode: McpEnvMode;
  mcpScope: "project" | "home";
  supportsGlobalMcp: boolean;
  supportsGlobalFiles: boolean;
};

/** Resolve contract defaults without hardcoding host ids in core/helpers. */
export function resolveIntegrationCapabilities(target: BapmIntegration): IntegrationCapabilities {
  const envMode = target.mcpEnvMode ?? "bake";
  return {
    mcpEnvMode: envMode,
    mcpHeadersEnvMode: target.mcpHeadersEnvMode ?? envMode,
    mcpScope: target.mcpScope ?? "project",
    supportsGlobalMcp: target.supportsGlobalMcp === true,
    supportsGlobalFiles: target.supportsGlobalFiles === true,
  };
}
