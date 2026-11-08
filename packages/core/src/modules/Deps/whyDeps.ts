import { resolve } from "node:path";
import { loadEffectiveLockfileOrNull, type LockedDependency } from "@/modules/Lockfile";
import { loadManifest, type DependencyEntry } from "@/modules/Manifest";
import { normalizeRepoIdentity } from "@/modules/Resolver";
import { resolvePackageQuery } from "./resolvePackageQuery.ts";
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
    loaded = loadEffectiveLockfileOrNull({ cwd });
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
  const direct = loadDirectContext(cwd);
  const parentsOf = buildParentsMap(deps, direct.rootName);

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
    chain: chain.map((key) => toPathNode(byKey.get(key) ?? { repo_url: key, name: key }, direct)),
  }));

  const pkg = toPackageMeta(target, direct);
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

export { repoBasename, repoOwnerRepo, resolvePackageQuery } from "./resolvePackageQuery.ts";

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

const LOCAL_PREFIX = /^(?:local:|_local\/)/i;

type ManifestDirectIdentity = {
  /** Exact package/repo forms declared by the manifest entry. */
  strong: Set<string>;
  /** Path/local values; matched against lock local-path basenames. */
  paths: string[];
};

type DirectContext = {
  /** Project name from the manifest; the resolver uses it as the chain root. */
  rootName?: string;
  entries: ManifestDirectIdentity[];
  /** True only when the manifest declares at least one direct APM dependency. */
  hasManifestInfo: boolean;
};

/**
 * Direct identities come from `dependencies.apm` + `devDependencies.apm`.
 * A malformed/missing manifest degrades to the legacy lock heuristics below.
 */
function loadDirectContext(cwd: string): DirectContext {
  try {
    const loaded = loadManifest({ cwd });
    const document = loaded.document;
    const entries = [
      ...listManifestApm(document.dependencies),
      ...listManifestApm(document.devDependencies),
    ].map(toManifestDirectIdentity);
    const rootName =
      typeof document.name === "string" && document.name.trim() ? document.name.trim() : undefined;
    return { rootName, entries, hasManifestInfo: entries.length > 0 };
  } catch {
    return { entries: [], hasManifestInfo: false };
  }
}

function listManifestApm(list: { apm?: DependencyEntry[] } | undefined): DependencyEntry[] {
  return list && Array.isArray(list.apm) ? list.apm : [];
}

function toManifestDirectIdentity(entry: DependencyEntry): ManifestDirectIdentity {
  const strong = new Set<string>();
  const paths: string[] = [];
  if (typeof entry === "string") {
    addIdentityForms(strong, entry);
    return { strong, paths };
  }
  const record = stringRecord(entry);
  for (const field of ["alias", "name", "id", "git", "registry", "marketplace", "spec"]) {
    const value = record[field];
    if (typeof value === "string" && value.length > 0) addIdentityForms(strong, value);
  }
  for (const field of ["path", "local"]) {
    const value = record[field];
    if (typeof value === "string" && value.length > 0) paths.push(value);
  }
  return { strong, paths };
}

function matchesManifestDirect(d: LockedDependency, ctx: DirectContext): boolean {
  const lockStrong = new Set<string>();
  const record = stringRecord(d);
  for (const field of ["name", "repo_url", "materialization_repo_url", "id"]) {
    const value = record[field];
    if (typeof value === "string" && value.length > 0) addIdentityForms(lockStrong, value);
  }
  const lockPathNames = lockPathBasenames(d);
  return ctx.entries.some(
    (entry) =>
      intersects(entry.strong, lockStrong) ||
      entry.paths.some((path) => lockPathNames.has(basenameToken(path))),
  );
}

function addIdentityForms(forms: Set<string>, value: string): void {
  const raw = value.trim();
  if (!raw) return;
  const noSlash = stripTrailingSlashes(raw);
  const relative = noSlash.replace(/^\.\//, "");
  const local = stripLocalPrefix(noSlash);
  const localRelative = local.replace(/^\.\//, "");
  for (const token of [
    raw,
    noSlash,
    stripGitSuffix(noSlash),
    relative,
    stripGitSuffix(relative),
    local,
    stripGitSuffix(local),
    localRelative,
    stripGitSuffix(localRelative),
  ]) {
    if (token) forms.add(token);
  }
  if (isRepoLike(noSlash)) {
    const identity = normalizeRepoIdentity(noSlash);
    forms.add(identity);
    forms.add(stripGitSuffix(identity));
  }
}

function isRepoLike(value: string): boolean {
  const v = stripTrailingSlashes(value.trim());
  if (!v || LOCAL_PREFIX.test(v)) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v) || /^git@[^:]+:/i.test(v)) return true;
  if (v.startsWith("./") || v.startsWith("../") || v.startsWith("/") || v.startsWith("~")) {
    return false;
  }
  return !/^@[^/]+\//.test(v) && v.includes("/");
}

function intersects(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  for (const value of a) {
    if (b.has(value)) return true;
  }
  return false;
}

function lockPathBasenames(d: LockedDependency): Set<string> {
  const names = new Set<string>();
  const record = stringRecord(d);
  for (const field of ["path", "local_path"]) {
    const value = record[field];
    if (typeof value === "string" && value.length > 0) names.add(basenameToken(value));
  }
  const repo = String(d.repo_url ?? "");
  const local = stripLocalPrefix(repo);
  if (local !== repo && local.length > 0) names.add(basenameToken(local));
  return names;
}

function stringRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stripTrailingSlashes(value: string): string {
  return value.replace(/[\\/]+$/g, "");
}

function stripGitSuffix(value: string): string {
  return value.replace(/\.git$/i, "");
}

function stripLocalPrefix(value: string): string {
  return value.replace(LOCAL_PREFIX, "");
}

function basenameToken(value: string): string {
  const trimmed = stripTrailingSlashes(value.trim());
  const parts = trimmed.split(/[\\/]/).filter(Boolean);
  const last = parts.length > 0 ? parts[parts.length - 1]! : trimmed;
  return stripGitSuffix(last);
}

function depthOf(d: LockedDependency): number | undefined {
  const raw = stringRecord(d).depth;
  const depth =
    typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : NaN;
  return Number.isFinite(depth) ? depth : undefined;
}

function resolvedBySegments(d: LockedDependency): string[] {
  const by = d.resolved_by;
  const raw = Array.isArray(by) ? by.map(String) : typeof by === "string" ? [by] : [];
  return raw
    .flatMap((segment) => segment.split(/->|,/))
    .map((segment) => stripVersionConstraint(segment.trim()))
    .filter(Boolean);
}

/** `via-b@~1.2.0` → `via-b`; scoped `@acme/tool@^1` → `@acme/tool`. */
function stripVersionConstraint(segment: string): string {
  const at = segment.lastIndexOf("@");
  return at > 0 ? segment.slice(0, at) : segment;
}

function buildParentsMap(
  deps: LockedDependency[],
  rootName: string | undefined,
): Map<string, string[]> {
  const parentsOf = new Map<string, string[]>();
  for (const d of deps) {
    const name = packageKey(d);
    if (!name) continue;
    const parents = [...new Set(resolvedBySegments(d).filter((p) => p !== name && p !== rootName))];
    parentsOf.set(name, parents);
  }
  return parentsOf;
}

/**
 * `is_direct` = lock `depth: 1` OR an exact identity declared in the manifest.
 * Empty `resolved_by` is NOT a direct signal when the manifest has direct deps:
 * old locks without `depth` and with an empty `resolved_by` are ambiguous.
 *
 * Without usable manifest identities (missing/unreadable manifest or no APM deps),
 * fall back to the legacy lock heuristics: `depth: 1`, empty/missing `resolved_by`,
 * or a `resolved_by` chain containing only the project root and the package itself.
 */
function isDirect(d: LockedDependency, ctx: DirectContext): boolean {
  if (depthOf(d) === 1) return true;
  if (ctx.hasManifestInfo) return matchesManifestDirect(d, ctx);

  const segments = resolvedBySegments(d);
  if (segments.length === 0) return true;
  const name = packageKey(d);
  return segments.every((segment) => segment === name || segment === ctx.rootName);
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

function toPackageMeta(d: LockedDependency, ctx: DirectContext): DepsWhyPackage {
  const pkg: DepsWhyPackage = {
    version: versionOf(d) || "-",
    source: sourceOf(d),
    is_direct: isDirect(d, ctx),
  };
  if (d.name != null && String(d.name).length > 0) pkg.name = String(d.name);
  if (d.repo_url != null && String(d.repo_url).length > 0) pkg.repo_url = String(d.repo_url);
  return pkg;
}

function toPathNode(d: LockedDependency, ctx: DirectContext): DepsWhyPathNode {
  const node: DepsWhyPathNode = {
    constraint: d.constraint != null ? String(d.constraint) : null,
    is_direct: isDirect(d, ctx),
  };
  if (d.name != null && String(d.name).length > 0) node.name = String(d.name);
  if (d.repo_url != null && String(d.repo_url).length > 0) node.repo_url = String(d.repo_url);
  return node;
}
