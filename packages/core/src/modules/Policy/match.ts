/**
 * Identity / pattern matcher for allow/deny/require (APM-like glob/prefix).
 * Supports exact match and single `*` segment / suffix globs (`org/*`, `leaf`).
 *
 * req-pl-018: optional host/source triggers ASCII fold of repository-coordinate
 * segments at match time only. Callers that need byte-exact (Section 6.4 merge)
 * omit the options bag.
 */

import {
  foldRepoCoordinatePath,
  inferHostFromIdentity,
  isCaseInsensitivePackageIdentity,
  stripHash,
  type RepoIdentityCaseOptions,
} from "@/common/repoIdentityCase.ts";

export type IdentityMatchOptions = RepoIdentityCaseOptions & {
  /**
   * Force fold on/off. When omitted, fold follows host/source disclosure rules
   * (and defaults bare `owner/repo` to github.com).
   */
  caseFold?: boolean;
};

export function identityMatchesPattern(
  identity: string,
  pattern: string,
  options?: IdentityMatchOptions,
): boolean {
  const foldedIdentity = prepareForMatch(identity, options, false);
  const foldedPattern = prepareForMatch(pattern, options, true);

  if (foldedIdentity === foldedPattern) return true;
  if (!foldedPattern.includes("*")) {
    // basename match: deny "leaf" matches package name "leaf"
    const base = foldedIdentity.includes("/") ? foldedIdentity.split("/").pop()! : foldedIdentity;
    return base === foldedPattern;
  }
  // Escape regex specials except *
  const escaped = foldedPattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(foldedIdentity);
}

export function anyIdentityMatches(
  identities: string[],
  pattern: string,
  options?: IdentityMatchOptions,
): boolean {
  return identities.some((id) => identityMatchesPattern(id, pattern, options));
}

/**
 * Exact require match (req-pl-018): `*` is literal; compare package portion
 * before `#` under the same fold rule. No glob.
 */
export function identitySatisfiesRequire(
  identity: string,
  requirePattern: string,
  options?: IdentityMatchOptions,
): boolean {
  const idBody = stripHash(identity);
  const reqBody = stripHash(requirePattern);
  return prepareForMatch(idBody, options, false) === prepareForMatch(reqBody, options, false);
}

function prepareForMatch(
  value: string,
  options: IdentityMatchOptions | undefined,
  isPattern: boolean,
): string {
  const host = options?.host ?? inferHostFromIdentity(value);
  const shouldFold =
    options?.caseFold === true
      ? true
      : options?.caseFold === false
        ? false
        : options != null &&
          isCaseInsensitivePackageIdentity({
            ...options,
            host,
          });

  // When options omitted entirely (merge), stay byte-exact on the raw string
  // but still strip nothing special — preserve prior behavior including `#`.
  if (options == null) {
    return value;
  }

  if (!shouldFold) {
    return stripHash(value);
  }

  return foldRepoCoordinatePath(value, {
    ...options,
    host,
    isPattern,
  });
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
