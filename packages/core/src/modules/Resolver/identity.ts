/**
 * Minimum-safe repo identity for resolve/cache (req-rs-016).
 * - Host case folded to lowercase
 * - Trailing `.git` stripped
 * - Path case: ASCII-folded for disclosed case-insensitive hosts (github.com,
 *   *.ghe.com, GITHUB_HOST); preserved for all other hosts
 * - Cache keys MUST NOT isolate solely by ref
 */

import { asciiLower, isCaseInsensitiveGitHost } from "@/common/repoIdentityCase.ts";

export function normalizeRepoIdentity(repoUrl: string): string {
  const trimmed = repoUrl.trim();
  let host = "";
  let path = "";

  if (/^git@([^:]+):(.+)$/.test(trimmed)) {
    const m = trimmed.match(/^git@([^:]+):(.+)$/)!;
    host = asciiLower(m[1]!);
    path = m[2]!;
  } else if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      host = u.hostname.toLowerCase();
      path = u.pathname.replace(/^\//, "");
    } catch {
      return stripGitSuffix(asciiLower(trimmed));
    }
  } else {
    // host/owner/repo or owner/repo
    const parts = trimmed.split("/");
    if (parts.length >= 3 && parts[0]!.includes(".")) {
      host = asciiLower(parts[0]!);
      path = parts.slice(1).join("/");
    } else if (parts.length >= 2) {
      host = "github.com";
      path = parts.join("/");
    } else {
      return stripGitSuffix(trimmed);
    }
  }

  path = stripGitSuffix(path);
  // Drop query/fragment leftovers
  path = path.split("?")[0]!.split("#")[0]!;
  if (isCaseInsensitiveGitHost(host)) {
    path = asciiLower(path);
  }
  return `${host}/${path}`.replace(/\/+$/, "");
}

/** Lockfile / display repo_url: host/path without scheme. */
export function toLockRepoUrl(repoUrl: string): string {
  return normalizeRepoIdentity(repoUrl);
}

function stripGitSuffix(s: string): string {
  return s.replace(/\.git$/i, "");
}

/**
 * Safe directory segment for modules cache keyed by identity (not by ref alone).
 */
export function identityToCacheDir(identity: string): string {
  return identity.replace(/[^a-zA-Z0-9._-]+/g, "_");
}
