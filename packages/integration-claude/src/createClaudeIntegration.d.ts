import type { BapmIntegration } from "@b-apm/integration-api";
/**
 * Create the Claude Code target.
 * Detect: `.claude/` directory **or** project-root `CLAUDE.md`.
 * Materialize: skills → `.claude/skills/<name>/SKILL.md` (never `.agents/skills/`),
 * instructions → `.claude/rules/<name>.md` (`applyTo` → `paths`),
 * agents → `.claude/agents/<name>.md`,
 * commands → `.claude/commands/<name>.md`,
 * hooks → merge `.claude/settings.json` (+ scripts under `.claude/hooks/`, ownership sidecar).
 * MCP: optional `configureMcp` writes project `.mcp.json` when `.claude/` exists.
 * Compile: default `CLAUDE.md`, omitting instruction primitives.
 */
export declare function createClaudeIntegration(options?: {
  id?: string;
  deployRoots?: string[];
}): BapmIntegration;
/**
 * Convert portable `applyTo` frontmatter to Claude `paths:` (omit when unconditional).
 */
export declare function transformClaudeRulesMarkdown(source: string): string;
