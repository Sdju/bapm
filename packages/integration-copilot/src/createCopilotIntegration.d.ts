import type { BapmIntegration } from "@b-apm/integration-api";
/**
 * Create the GitHub Copilot runtime target.
 * Detect: APM SIGNAL_WHITELIST under `.github/` (any one signal; no mkdir).
 * Materialize: instructions/prompts/agents/hooks under `.github/`, skills under `.agents/skills/`.
 * MCP: home `~/.copilot/mcp-config.json` (`COPILOT_HOME`) with translate placeholders.
 * Compile: thin `.github/copilot-instructions.md`, omitting instruction primitives.
 */
export declare function createCopilotIntegration(options?: {
  id?: string;
  deployRoots?: string[];
}): BapmIntegration;
/** Normalize hook event names to camelCase (`session_start` / `SessionStart` → `sessionStart`). */
export declare function toCamelCaseEvent(event: string): string;
