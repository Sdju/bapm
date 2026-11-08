import type { BapmIntegration } from "@b-apm/integration-api";
/**
 * Create the Codex CLI target.
 * Detect: project-root `.codex/` directory only (not lone `AGENTS.md`).
 * Materialize: skills → `.agents/skills/<name>/SKILL.md`,
 * agents → `.codex/agents/<name>.toml`,
 * instruction/command/prompt → skip (non-fatal diagnostics),
 * hooks → merge `.codex/hooks.json` (+ scripts / ownership sidecar).
 * MCP: `configureMcp` → `.codex/config.toml` `mcp_servers`.
 * Compile: project-root `AGENTS.md` including instructions (last-writer vs Cursor).
 */
export declare function createCodexIntegration(options?: {
  id?: string;
  deployRoots?: string[];
}): BapmIntegration;
