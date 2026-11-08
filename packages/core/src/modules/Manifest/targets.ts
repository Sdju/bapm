/**
 * OpenAPM mf-005 target / targets token validation.
 * Canonical set + legacy aliases from OpenAPM v0.1 §4.2.1.
 */

/** Canonical host ids registered by OpenAPM v0.1 (plus `all`). */
export const CANONICAL_TARGET_TOKENS = new Set([
  "copilot",
  "claude",
  "cursor",
  "codex",
  "gemini",
  "antigravity",
  "opencode",
  "windsurf",
  "kiro",
  "grok-build",
  "agent-skills",
  "all",
]);

/**
 * Legacy aliases accepted on input. Parsing canonicalises them to the mapped
 * host id so install / compile / registry lookup never see the alias.
 */
export const TARGET_ALIAS_TO_CANONICAL: ReadonlyMap<string, string> = new Map([
  ["vscode", "copilot"],
  ["agents", "copilot"],
]);

/** Legacy alias tokens accepted on input. */
export const TARGET_ALIAS_TOKENS = new Set(TARGET_ALIAS_TO_CANONICAL.keys());

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

/**
 * Canonical host id for a validated target token. Aliases (`vscode`, `agents`)
 * map to `copilot`; canonical and vendor tokens are returned trimmed as-is.
 */
export function normalizeTargetToken(token: string): string {
  const t = token.trim();
  return TARGET_ALIAS_TO_CANONICAL.get(t) ?? t;
}
