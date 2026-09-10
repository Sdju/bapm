/**
 * Package identity normalization (APM `normalize_package_repo_url` subset).
 * Used for materialization_repo_url identity checks and sort keys — not display.
 */

import {
  inferHostFromIdentity,
  normalizePackageRepoPath,
  type RepoIdentityCaseOptions,
} from "@/common/repoIdentityCase.ts";

export function normalizePackageRepoUrl(
  repoUrl: string,
  options?: { source?: string; host?: string; registryPrefix?: string },
): string {
  const host = options?.host ?? inferHostFromIdentity(repoUrl);
  const caseOpts: RepoIdentityCaseOptions = {
    host,
    source: options?.source,
    registryPrefix: options?.registryPrefix,
  };
  return normalizePackageRepoPath(repoUrl, caseOpts);
}

/** Alias accepted by acceptance helpers. */
export const normalizeLockPackageRepoUrl = normalizePackageRepoUrl;
