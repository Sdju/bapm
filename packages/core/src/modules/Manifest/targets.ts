/**
 * OpenAPM mf-005 target / targets token validation.
 * Canonical set + legacy aliases from OpenAPM v0.1 §4.2.1.
 */

/** Canonical host ids registered by OpenAPM v0.1. */
export const CANONICAL_TARGET_TOKENS = new Set([
  "copilot",
  "claude",
  "cursor",
  "codex",
  "gemini",
  "antigravity",
  "opencode",
  "windsurf",
  "agent-skills",
  "all",
]);

/** Legacy aliases accepted on input (normalised by writers elsewhere). */
export const TARGET_ALIAS_TOKENS = new Set(["vscode", "agents"]);

/** Vendor extension: `x-<vendor>-<name>` (OpenAPM req-mf-005). */
export const VENDOR_TARGET_RE = /^x-[a-z][a-z0-9-]*-[a-z][a-z0-9-]*$/;

export function isValidTargetToken(token: string): boolean {
  const t = token.trim();
  if (!t) return false;
  if (CANONICAL_TARGET_TOKENS.has(t)) return true;
  if (TARGET_ALIAS_TOKENS.has(t)) return true;
  if (VENDOR_TARGET_RE.test(t)) return true;
  return false;
}
