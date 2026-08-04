/**
 * Package identity normalization (APM `normalize_package_repo_url` subset for M2).
 * Used for materialization_repo_url identity checks and sort keys — not display.
 */

export function normalizePackageRepoUrl(
  repoUrl: string,
  options?: { source?: string; host?: string; registryPrefix?: string },
): string {
  const source = options?.source;
  if (source === "local" || source === "marketplace") {
    return repoUrl;
  }
  if (source === "registry" || options?.registryPrefix) {
    return repoUrl.toLowerCase();
  }

  const host = (options?.host ?? inferHost(repoUrl)).toLowerCase();
  if (host === "github.com" || /^github\.com(?:\/|$)/i.test(repoUrl)) {
    return repoUrl.toLowerCase();
  }
  return repoUrl;
}

function inferHost(repoUrl: string): string {
  // Shorthand `github.com/owner/repo` or URL-ish forms.
  const trimmed = repoUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).hostname;
    } catch {
      return "github.com";
    }
  }
  const slash = trimmed.indexOf("/");
  if (slash > 0 && trimmed.includes(".")) {
    return trimmed.slice(0, slash);
  }
  return "github.com";
}
