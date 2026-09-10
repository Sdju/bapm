/**
 * Shared ASCII repository-coordinate case rule (req-rs-016 §3 / req-pl-018).
 * Match-time / identity-boundary only — never for display paths or policy merge.
 */

/** GitHub-class hosts: owner/repo = 2 repository-coordinate segments. */
export const GITHUB_REPO_COORD_SEGMENTS = 2;

export type RepoIdentityCaseOptions = {
  host?: string | null;
  source?: string | null;
  registryPrefix?: string | null;
  /** When true, treat as local (no path fold). */
  isLocal?: boolean;
  /** When true, treat as marketplace (no path fold). */
  isMarketplace?: boolean;
  /**
   * Env lookup for GHES (`GITHUB_HOST`). Defaults to `process.env.GITHUB_HOST`.
   * Injected in tests.
   */
  githubHostEnv?: string | null;
};

/** ASCII `A–Z` → `a–z` only (no Unicode / locale folding). */
export function asciiLower(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    out += code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : s[i]!;
  }
  return out;
}

export function resolveGithubHostEnv(options?: RepoIdentityCaseOptions): string {
  if (options && "githubHostEnv" in options) {
    return String(options.githubHostEnv ?? "")
      .trim()
      .toLowerCase();
  }
  return String(process.env.GITHUB_HOST ?? "")
    .trim()
    .toLowerCase();
}

/**
 * Disclosed case-insensitive git hosts: github.com, *.ghe.com, literal GITHUB_HOST.
 */
export function isCaseInsensitiveGitHost(
  host: string | null | undefined,
  options?: RepoIdentityCaseOptions,
): boolean {
  if (!host) return false;
  const h = asciiLower(host.trim());
  if (!h) return false;
  if (h === "github.com") return true;
  if (h.endsWith(".ghe.com")) return true;
  const ghes = resolveGithubHostEnv(options);
  return Boolean(ghes && ghes === h);
}

/**
 * Whether repository-coordinate path casing is excluded from identity / match.
 * Registry (+ registry prefix) always folds; local/marketplace never; else host rule.
 */
export function isCaseInsensitivePackageIdentity(options: RepoIdentityCaseOptions = {}): boolean {
  if (options.isLocal || options.source === "local") return false;
  if (options.isMarketplace || options.source === "marketplace") return false;
  if (options.source === "registry" || options.registryPrefix) return true;
  const host = options.host ?? inferHostFromIdentity("");
  return isCaseInsensitiveGitHost(host, options);
}

/**
 * Infer host from an identity / URL-ish string.
 * Bare `owner/repo` → github.com; leading FQDN segment → that host.
 */
export function inferHostFromIdentity(identity: string, fallback = "github.com"): string {
  const trimmed = stripHash(identity).trim();
  if (!trimmed) return fallback;

  if (/^git@([^:]+):/.test(trimmed)) {
    return asciiLower(trimmed.match(/^git@([^:]+):/)![1]!);
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).hostname.toLowerCase();
    } catch {
      return fallback;
    }
  }

  const parts = trimmed.split("/").filter(Boolean);
  if (parts.length >= 2 && parts[0]!.includes(".")) {
    return asciiLower(parts[0]!);
  }
  return fallback;
}

/** Strip `#ref` suffix; keep package / pattern body. */
export function stripHash(value: string): string {
  const i = value.indexOf("#");
  return i >= 0 ? value.slice(0, i) : value;
}

/**
 * Host-blind path for matching: drop leading FQDN host segment when present.
 */
export function hostBlindPath(identity: string, host?: string | null): string {
  const raw = stripHash(identity)
    .trim()
    .replace(/\.git$/i, "");
  if (!raw) return raw;
  const parts = raw.split("/").filter(Boolean);
  if (parts.length === 0) return raw;

  const effectiveHost = host ? asciiLower(host) : "";
  if (effectiveHost && asciiLower(parts[0]!) === effectiveHost) {
    return parts.slice(1).join("/");
  }
  if (parts[0]!.includes(".") && parts.length >= 2) {
    // Leading FQDN in the identity string itself.
    return parts.slice(1).join("/");
  }
  return parts.join("/");
}

/**
 * Fold repository-coordinate segments under the disclosed case rule.
 * Virtual path / segments after the repo-coord prefix stay byte-exact.
 * For globs, foldable prefix stops before the first segment containing `**`.
 */
export function foldRepoCoordinatePath(
  value: string,
  options: RepoIdentityCaseOptions & { isPattern?: boolean } = {},
): string {
  const body = stripHash(value);
  if (!body) return body;

  const host = options.host ?? inferHostFromIdentity(body);
  const fold =
    options.source === "registry" || options.registryPrefix
      ? true
      : isCaseInsensitivePackageIdentity({ ...options, host });

  if (!fold) return body;

  // Registry: entire coordinate string (host-blind) is case-insensitive.
  if (options.source === "registry" || options.registryPrefix) {
    const path = hostBlindPath(body, host);
    const folded = asciiLower(path);
    // Preserve leading host segment if authored into the value.
    const parts = body.split("/").filter(Boolean);
    if (parts.length >= 2 && parts[0]!.includes(".")) {
      return `${parts[0]}/${folded}`;
    }
    return folded;
  }

  const path = hostBlindPath(body, host);
  const segments = path.split("/").filter((s) => s.length > 0);
  if (segments.length === 0) return body;

  let foldCount = GITHUB_REPO_COORD_SEGMENTS;
  if (options.isPattern) {
    const starStarAt = segments.findIndex((s) => s.includes("**"));
    if (starStarAt >= 0) {
      foldCount = Math.min(foldCount, starStarAt);
    }
  }

  const folded = segments.map((seg, i) => (i < foldCount ? asciiLower(seg) : seg));
  const foldedPath = folded.join("/");

  const parts = body.split("/").filter(Boolean);
  if (parts.length >= 2 && parts[0]!.includes(".")) {
    return `${parts[0]}/${foldedPath}`;
  }
  return foldedPath;
}

/**
 * Identity-boundary normalization of a package repo path (APM `normalize_package_repo_url`).
 * Never use for display / filesystem paths.
 */
export function normalizePackageRepoPath(
  repoUrl: string,
  options: RepoIdentityCaseOptions = {},
): string {
  if (options.isLocal || options.source === "local") return repoUrl;
  if (options.isMarketplace || options.source === "marketplace") return repoUrl;
  if (options.source === "registry" || options.registryPrefix) {
    return asciiLower(repoUrl);
  }
  const host = options.host ?? inferHostFromIdentity(repoUrl);
  if (isCaseInsensitiveGitHost(host, options)) {
    return asciiLower(repoUrl);
  }
  return repoUrl;
}
