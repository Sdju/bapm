/**
 * Known published host ids → default `@b-apm/integration-<id>` specifier.
 * Used when object-map `targets:` omits a host (canonical fallback load).
 */
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

/** Host ids with a published `@b-apm/integration-*` package in this monorepo. */
export const CANONICAL_HOST_IDS = [
  "cursor",
  "opencode",
  "copilot",
  "windsurf",
  "kiro",
  "grok-build",
  "antigravity",
  "agent-skills",
  "claude",
  "codex",
  "gemini",
] as const;

export type CanonicalHostId = (typeof CANONICAL_HOST_IDS)[number];

export function isCanonicalHostId(id: string): id is CanonicalHostId {
  return (CANONICAL_HOST_IDS as readonly string[]).includes(id);
}

/** Default npm specifier for a known host id. */
export function canonicalPackageSpecifier(hostId: string): string {
  return `@b-apm/integration-${hostId}`;
}

function isDir(cwd: string, rel: string): boolean {
  const p = join(cwd, rel);
  return existsSync(p) && statSync(p).isDirectory();
}

function isFile(cwd: string, rel: string): boolean {
  const p = join(cwd, rel);
  return existsSync(p) && statSync(p).isFile();
}

/**
 * Lightweight filesystem probe mirroring published integration `detect` markers.
 * Used only for diagnostics when the package is not registered (not for selection).
 */
export function probeCanonicalHostMarkers(cwd: string): string[] {
  const found: string[] = [];

  if (isDir(cwd, ".cursor") || isFile(cwd, ".cursorrules")) found.push("cursor");
  if (isDir(cwd, ".opencode") || isFile(cwd, "opencode.json") || isFile(cwd, "opencode.jsonc")) {
    found.push("opencode");
  }
  if (
    isFile(cwd, ".github/copilot-instructions.md") ||
    isDir(cwd, ".github/instructions") ||
    isDir(cwd, ".github/agents") ||
    isDir(cwd, ".github/prompts") ||
    isDir(cwd, ".github/hooks")
  ) {
    found.push("copilot");
  }
  if (isDir(cwd, ".windsurf")) found.push("windsurf");
  if (isDir(cwd, ".kiro")) found.push("kiro");
  if (isDir(cwd, ".grok")) found.push("grok-build");
  if (isDir(cwd, ".claude") || isFile(cwd, "CLAUDE.md")) found.push("claude");
  if (isDir(cwd, ".codex")) found.push("codex");
  if (isDir(cwd, ".gemini") || isFile(cwd, "GEMINI.md")) found.push("gemini");

  return found;
}
