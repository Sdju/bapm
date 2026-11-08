import type { BapmIntegration } from "@b-apm/integration-api";
/**
 * Create the Cursor target.
 * Detect: `.cursor/` directory **or** legacy `.cursorrules` file.
 * Materialize: skills → `.agents/skills/<name>/SKILL.md`,
 * instructions → `.cursor/rules/<name>.mdc`,
 * agents → `.cursor/agents/<name>.md`,
 * commands → `.cursor/commands/<name>.md`,
 * hooks → merge `.cursor/hooks.json` (+ script copy under `.cursor/hooks/`).
 * MCP: optional `configureMcp` writes `.cursor/mcp.json` (not via materialize).
 */
export declare function createCursorIntegration(options?: {
  id?: string;
  deployRoots?: string[];
}): BapmIntegration;
