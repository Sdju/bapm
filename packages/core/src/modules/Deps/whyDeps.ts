import { resolve } from "node:path";
import { loadLockfileOrNull, type LockedDependency } from "@/modules/Lockfile";
import type {
  DepsWhyPackage,
  DepsWhyPath,
  DepsWhyPathNode,
  DepsWhyResult,
  RunDepsOptions,
} from "./types.ts";

/**
 * Offline reverse walk from lock edges (rs-005 SHOULD).
 * Honest exits: 0 success, 1 not_installed/ambiguous, 2 no_lockfile.
 */
export function whyDeps(options: RunDepsOptions = {}): DepsWhyResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  const query = String(options.package ?? options.name ?? options.packages?.[0] ?? "").trim();

  let loaded;
  try {
    loaded = loadLockfileOrNull({ cwd });
  } catch {
    return failNoLockfile(query);
  }
  if (!loaded) {
    return failNoLockfile(query);
  }

  const deps = loaded.document.dependencies ?? [];
  const matches = resolvePackageQuery(deps, query);

  if (matches.length === 0) {
    return {
      ok: false,
      exitCode: 1,
      error: "not_installed",
      query,
      chains: [],
      text: `Package not installed: ${query || "(missing package)"}`,
    };
  }

  if (matches.length > 1) {
    const matchIds = matches.map((m) => ({
      ...(m.name ? { name: String(m.name) } : {}),
      ...(m.repo_url ? { repo_url: String(m.repo_url) } : {}),
    }));
    return {
      ok: false,
      exitCode: 1,
      error: "ambiguous",
      query,
      matches: matchIds,
      chains: [],
      text: `Ambiguous package query ${query}: ${matchIds
        .map((m) => m.name ?? m.repo_url ?? "?")
        .join(", ")}`,
    };
  }

  const target = matches[0]!;
  const targetKey = packageKey(target);
  const byKey = indexByKey(deps);
  const parentsOf = buildParentsMap(deps);

  const nameChains: string[][] = [];
  function walk(node: string, path: string[]): void {
    const parents = parentsOf.get(node) ?? [];
    if (parents.length === 0) {
      nameChains.push([...path].reverse());
      return;
    }
    for (const p of parents) {
      if (path.includes(p)) continue;
      walk(p, [...path, p]);
    }
  }

  walk(targetKey, [targetKey]);
  nameChains.sort((a, b) => a.join("\0").localeCompare(b.join("\0")));

  const paths: DepsWhyPath[] = nameChains.map((chain) => ({
    chain: chain.map((key) => toPathNode(byKey.get(key) ?? { repo_url: key, name: key })),
  }));

  const pkg = toPackageMeta(target);
  const text =
    nameChains.length === 0
      ? `No dependency chains found for ${targetKey}`
      : nameChains.map((c) => c.join(" → ")).join("\n");

  return {
    ok: true,
    exitCode: 0,
    package: pkg,
    paths,
    chains: nameChains,
    text,
  };
}

export const depsWhy = whyDeps;
export const runDepsWhy = whyDeps;

function failNoLockfile(query: string): DepsWhyResult {
  return {
    ok: false,
    exitCode: 2,
    error: "no_lockfile",
    query: query || undefined,
    chains: [],
    text: "No lockfile found (missing or unreadable)",
  };
}

/**
 * Staged resolve: exact name|repo_url → unique owner/repo → unique basename.
 * Stop at the first form with ≥1 match (ambiguous if ≥2 at that form).
 */
function resolvePackageQuery(deps: LockedDependency[], query: string): LockedDependency[] {
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

function packageKey(d: LockedDependency): string {
  return String(d.name ?? d.repo_url ?? "");
}

function indexByKey(deps: LockedDependency[]): Map<string, LockedDependency> {
  const map = new Map<string, LockedDependency>();
  for (const d of deps) {
    const key = packageKey(d);
    if (key) map.set(key, d);
  }
  return map;
}

function buildParentsMap(deps: LockedDependency[]): Map<string, string[]> {
  const parentsOf = new Map<string, string[]>();
  for (const d of deps) {
    const name = packageKey(d);
    if (!name) continue;
    const by = d.resolved_by;
    const parents = Array.isArray(by)
      ? by.map(String)
      : typeof by === "string"
        ? by
            .split(/->|,/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    parentsOf.set(
      name,
      parents.map((p) => (p.includes("@") ? p.split("@")[0]! : p)),
    );
  }
  return parentsOf;
}

function isDirect(d: LockedDependency): boolean {
  const by = d.resolved_by;
  if (by == null) return true;
  if (Array.isArray(by)) return by.length === 0;
  if (typeof by === "string") return by.trim() === "";
  return false;
}

function versionOf(d: LockedDependency): string {
  const v =
    d.version ?? d.resolved_tag ?? d.resolved_ref ?? d.resolved_commit ?? d.resolved_hash ?? "";
  return String(v);
}

function sourceOf(d: LockedDependency): string {
  if (d.source != null && String(d.source).length > 0) return String(d.source);
  return String(d.repo_url ?? "").startsWith("local:") ? "local" : "git";
}

function toPackageMeta(d: LockedDependency): DepsWhyPackage {
  const pkg: DepsWhyPackage = {
    version: versionOf(d) || "-",
    source: sourceOf(d),
    is_direct: isDirect(d),
  };
  if (d.name != null && String(d.name).length > 0) pkg.name = String(d.name);
  if (d.repo_url != null && String(d.repo_url).length > 0) pkg.repo_url = String(d.repo_url);
  return pkg;
}

function toPathNode(d: LockedDependency): DepsWhyPathNode {
  const node: DepsWhyPathNode = {
    constraint: d.constraint != null ? String(d.constraint) : null,
    is_direct: isDirect(d),
  };
  if (d.name != null && String(d.name).length > 0) node.name = String(d.name);
  if (d.repo_url != null && String(d.repo_url).length > 0) node.repo_url = String(d.repo_url);
  return node;
}
