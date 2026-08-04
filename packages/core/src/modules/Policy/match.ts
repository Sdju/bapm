/**
 * Identity / pattern matcher for allow/deny/require (APM-like glob/prefix).
 * Supports exact match and single `*` segment / suffix globs (`org/*`, `leaf`).
 */
export function identityMatchesPattern(identity: string, pattern: string): boolean {
  if (identity === pattern) return true;
  if (!pattern.includes("*")) {
    // basename match: deny "leaf" matches package name "leaf"
    const base = identity.includes("/") ? identity.split("/").pop()! : identity;
    return base === pattern;
  }
  // Escape regex specials except *
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(identity);
}

export function anyIdentityMatches(identities: string[], pattern: string): boolean {
  return identities.some((id) => identityMatchesPattern(id, pattern));
}

const HEX40_RE = /^[0-9a-f]{40}$/i;
const SEMVER_TAG_RE =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[-0-9A-Za-z.]+)?(?:\+[0-9A-Za-z.]+)?$/;
const BOUNDED_RANGE_RE = /^(>=|>|<=|<|~|\^)?\s*v?\d/;

/**
 * pl-007/008: unbounded direct refs when require_pinned_constraint is true.
 * Pinned OK: 40-hex, v?semver tag, bounded range, registry source, local path.
 */
export function isPinnedConstraint(args: {
  ref?: string;
  constraint?: string;
  path?: string;
  source?: string;
  kind?: string;
}): boolean {
  if (args.path || args.kind === "local" || args.source === "local") return true;
  if (args.source === "registry" || args.kind === "registry") return true;

  const value = (args.constraint ?? args.ref ?? "").trim();
  if (!value) return false;
  if (value === "*" || value === "latest" || value === "HEAD") return false;
  if (HEX40_RE.test(value)) return true;
  if (SEMVER_TAG_RE.test(value)) return true;
  // Bare branch / unbounded >=X without upper bound
  if (value.startsWith(">=") && !/\s+</.test(value) && !/\s+<=/.test(value)) {
    // Treat as unbounded unless it looks like a closed interval elsewhere
    return false;
  }
  if (BOUNDED_RANGE_RE.test(value) && !value.startsWith(">=") && !value.startsWith(">")) {
    return true;
  }
  // caret/tilde ranges are bounded-enough for pl-008 spirit
  if (/^[~^]/.test(value)) return true;
  return false;
}
