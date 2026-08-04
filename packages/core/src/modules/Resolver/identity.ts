/**
 * Minimum-safe repo identity for resolve/cache (req-rs-016).
 * - Host case folded to lowercase
 * - Trailing `.git` stripped
 * - Path case preserved (example/REPO ≠ example/repo)
 * - Cache keys MUST NOT isolate solely by ref
 */

export function normalizeRepoIdentity(repoUrl: string): string {
  const trimmed = repoUrl.trim();
  let host = "";
  let path = "";

  if (/^git@([^:]+):(.+)$/.test(trimmed)) {
    const m = trimmed.match(/^git@([^:]+):(.+)$/)!;
    host = m[1]!.toLowerCase();
    path = m[2]!;
  } else if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      host = u.hostname.toLowerCase();
      path = u.pathname.replace(/^\//, "");
    } catch {
      return stripGitSuffix(trimmed.toLowerCase());
    }
  } else {
    // host/owner/repo or owner/repo
    const parts = trimmed.split("/");
    if (parts.length >= 3 && parts[0]!.includes(".")) {
      host = parts[0]!.toLowerCase();
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
