import type { LockedDependency } from "@/modules/Lockfile";

/**
 * Staged resolve: exact name|repo_url → unique owner/repo → unique basename.
 * Stop at the first form with ≥1 match (ambiguous if ≥2 at that form).
 */
export function resolvePackageQuery(deps: LockedDependency[], query: string): LockedDependency[] {
  if (!query) return [];
  const exact = findExactMatches(deps, query);
  if (exact.length > 0) return exact;
  const byOwnerRepo = findByDerivedForm(deps, query, repoOwnerRepo);
  if (byOwnerRepo.length > 0) return byOwnerRepo;
  return findByDerivedForm(deps, query, repoBasename);
}

function findExactMatches(deps: LockedDependency[], query: string): LockedDependency[] {
  if (!query) return [];
  const out: LockedDependency[] = [];
  const seen = new Set<string>();
  for (const d of deps) {
    const name = d.name != null ? String(d.name) : "";
    const repo = d.repo_url != null ? String(d.repo_url) : "";
    if (name !== query && repo !== query) continue;
    const id = packageKey(d);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(d);
  }
  return out;
}

function findByDerivedForm(
  deps: LockedDependency[],
  query: string,
  derive: (repoUrl: string) => string | null,
): LockedDependency[] {
  const out: LockedDependency[] = [];
  const seen = new Set<string>();
  for (const d of deps) {
    const repo = d.repo_url != null ? String(d.repo_url) : "";
    if (!repo) continue;
    const form = derive(repo);
    if (form == null || form !== query) continue;
    const id = packageKey(d);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(d);
  }
  return out;
}

function packageKey(d: LockedDependency): string {
  return String(d.name ?? d.repo_url ?? "");
}

/** Path segments from `repo_url` (URL pathname when parseable, else `/`-split). */
function repoPathSegments(repoUrl: string): string[] {
  const trimmed = repoUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return [];
  try {
    const path = new URL(trimmed).pathname.replace(/^\/+|\/+$/g, "");
    if (path) return path.split("/").filter(Boolean);
  } catch {
    // not a parseable URL — fall through
  }
  return trimmed.split("/").filter(Boolean);
}

function stripTrailingGit(segment: string): string {
  return segment.endsWith(".git") ? segment.slice(0, -".git".length) : segment;
}

/** Last path segment of `repo_url`, trailing `.git` stripped. */
export function repoBasename(repoUrl: string): string | null {
  const segs = repoPathSegments(repoUrl);
  if (segs.length === 0) return null;
  const base = stripTrailingGit(segs[segs.length - 1]!);
  return base || null;
}

/**
 * Last two path segments as `owner/repo` (`.git` stripped on repo).
 * Fewer than two segments → full trimmed `repo_url` as identity.
 */
export function repoOwnerRepo(repoUrl: string): string | null {
  const trimmed = repoUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  const segs = repoPathSegments(trimmed);
  if (segs.length === 0) return null;
  if (segs.length < 2) return trimmed;
  const owner = segs[segs.length - 2]!;
  const repo = stripTrailingGit(segs[segs.length - 1]!);
  return `${owner}/${repo}`;
}
