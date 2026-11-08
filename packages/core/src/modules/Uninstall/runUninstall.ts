import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadManifest, writeManifest, type DependencyEntry } from "@/modules/Manifest";
import {
  loadEffectiveLockfileOrNull,
  partitionAndWriteLockfiles,
  type LockedDependency,
} from "@/modules/Lockfile";
import { cleanupOrphanDeployedFiles } from "@/modules/Install";
import { APM_MODULES_DIR, identityToCacheDir, normalizeRepoIdentity } from "@/modules/Resolver";
import { syncCopilotNativeRegistrationFromLock } from "@/modules/CopilotNativeRegistration";
import { UninstallError } from "./errors.ts";
import type { RunUninstallOptions, UninstallResult } from "./types.ts";

/**
 * Remove named packages from manifest + modules + deployed inventory + lock.
 */
export async function runUninstall(options: RunUninstallOptions = {}): Promise<UninstallResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const dryRun = options.dryRun === true || options["dry-run"] === true;
  const targets = [...(options.packages ?? []), ...(options.names ?? [])].filter(Boolean);
  if (targets.length === 0) {
    throw new UninstallError(
      "UNINSTALL_NO_PACKAGES",
      "uninstall requires at least one package name",
    );
  }

  const loadedManifest = loadManifest({ cwd });
  const loadedLock = loadEffectiveLockfileOrNull({ cwd });
  const lockDeps = loadedLock?.document.dependencies ?? [];

  const manifestEntries = [
    ...(Array.isArray(loadedManifest.document.dependencies?.apm)
      ? loadedManifest.document.dependencies.apm
      : []),
    ...(Array.isArray(loadedManifest.document.devDependencies?.apm)
      ? loadedManifest.document.devDependencies.apm
      : []),
  ];

  // Each target is an exact identity (name, alias, id, full git URL, short
  // name, path, or path basename). Never match by substring.
  const targetIdentities = targets.map(targetIdentityForms);
  const matchedManifestEntries = manifestEntries.filter((entry) =>
    targetIdentities.some((identity) => manifestMatchesTarget(entry, identity)),
  );

  for (const [index, name] of targets.entries()) {
    const identity = targetIdentities[index]!;
    const found =
      manifestEntries.some((entry) => manifestMatchesTarget(entry, identity)) ||
      lockDeps.some((dep) => lockMatchesTarget(dep, identity));
    if (!found) {
      throw new UninstallError("UNINSTALL_UNKNOWN", `Package not found / not installed: ${name}`, {
        details: { name },
      });
    }
  }

  // A lock entry is direct when the target identifies it directly, or when it
  // belongs to a manifest entry the target matched (e.g. alias / path with a
  // different package name).
  const directLockDeps = lockDeps.filter(
    (dep) =>
      targetIdentities.some((identity) => lockMatchesTarget(dep, identity)) ||
      matchedManifestEntries.some((entry) => manifestEntryLinksToLock(entry, dep)),
  );

  // Collect lock names to remove (direct + orphaned transitives resolved_by only those)
  const removeLockNames = collectRemovals(lockDeps, directLockDeps);
  const plan = [...removeLockNames].map((n) => `uninstall ${n}`);

  if (dryRun) {
    return {
      ok: true,
      exitCode: 0,
      dryRun: true,
      removed: [...removeLockNames],
      text: plan.join("\n"),
      plan,
    };
  }

  // Manifest write-back
  const doc = { ...loadedManifest.document };
  if (doc.dependencies?.apm) {
    doc.dependencies = {
      ...doc.dependencies,
      apm: filterApm(doc.dependencies.apm, targetIdentities, directLockDeps),
    };
  }
  if (doc.devDependencies?.apm) {
    doc.devDependencies = {
      ...doc.devDependencies,
      apm: filterApm(doc.devDependencies.apm, targetIdentities, directLockDeps),
    };
  }
  writeManifest(doc, {
    cwd,
    sourcePath: loadedManifest.sourcePath,
    sourceFilename: loadedManifest.sourceFilename,
  });

  // Modules dirs (by lock name and local_/git cache identity)
  for (const name of removeLockNames) {
    const dir = join(cwd, APM_MODULES_DIR, name);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }
  for (const d of lockDeps) {
    const name = String(d.name ?? "");
    if (!name || !removeLockNames.has(name)) continue;
    const repo = String(d.repo_url ?? "");
    if (repo.startsWith("local:")) {
      const localId = repo.replace(/^local:/, "local_");
      const localDir = join(cwd, APM_MODULES_DIR, identityToCacheDir(localId));
      if (existsSync(localDir)) rmSync(localDir, { recursive: true, force: true });
    }
  }

  // Lock rewrite + deploy cleanup
  const remaining = lockDeps.filter((d) => !removeLockNames.has(String(d.name ?? "")));
  const currentDepNames = new Set(remaining.map((d) => String(d.name ?? "")).filter(Boolean));

  if (loadedLock) {
    cleanupOrphanDeployedFiles({
      cwd,
      previous: loadedLock.document,
      currentDepNames,
    });
    partitionAndWriteLockfiles(
      {
        ...loadedLock.document,
        dependencies: remaining,
        generated_at: new Date().toISOString(),
      },
      {
        cwd,
        sourcePath: loadedLock.sourcePath,
        sourceFilename: loadedLock.sourceFilename,
      },
    );
  }

  syncCopilotNativeRegistrationFromLock({ cwd, dryRun: false });

  return {
    ok: true,
    exitCode: 0,
    dryRun: false,
    removed: [...removeLockNames],
    text: plan.join("\n"),
    plan,
  };
}

export const uninstallPackages = runUninstall;
export const uninstall = runUninstall;

const LOCAL_PREFIX = /^(?:local:|_local\/)/i;

function stripTrailingSlashes(value: string): string {
  return value.replace(/[\\/]+$/g, "");
}

function stripGitSuffix(value: string): string {
  return value.replace(/\.git$/i, "");
}

function basenameToken(value: string): string {
  const trimmed = stripTrailingSlashes(value.trim());
  const parts = trimmed.split(/[\\/]/).filter(Boolean);
  const last = parts.length > 0 ? parts[parts.length - 1]! : trimmed;
  return stripGitSuffix(last);
}

function localStripped(value: string): string {
  return value.replace(LOCAL_PREFIX, "");
}

function isScopedName(value: string): boolean {
  return /^@[^/]+\//.test(value);
}

function shouldCanonicalizeRepo(value: string): boolean {
  const v = stripTrailingSlashes(value.trim());
  if (!v || LOCAL_PREFIX.test(v)) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v) || /^git@[^:]+:/i.test(v)) return true;
  if (v.startsWith("./") || v.startsWith("../") || v.startsWith("/") || v.startsWith("~")) {
    return false;
  }
  return !isScopedName(v) && v.includes("/");
}

/**
 * Normalize a value into exact identity tokens. Only whitespace, trailing
 * slashes and a trailing `.git` are folded; no substring / prefix matching.
 */
function addTokenForms(
  forms: Set<string>,
  value: string,
  options: { basename?: boolean; repoIdentity?: boolean } = {},
): void {
  const raw = value.trim();
  if (!raw) return;
  const noSlash = stripTrailingSlashes(raw);
  const relative = noSlash.replace(/^\.\//, "");
  const local = localStripped(noSlash);
  const localRelative = local.replace(/^\.\//, "");
  const tokens = [
    raw,
    noSlash,
    stripGitSuffix(noSlash),
    relative,
    stripGitSuffix(relative),
    local,
    stripGitSuffix(local),
    localRelative,
    stripGitSuffix(localRelative),
  ];
  for (const token of tokens) {
    if (token) forms.add(token);
  }
  if (options.repoIdentity && shouldCanonicalizeRepo(noSlash)) {
    const identity = normalizeRepoIdentity(noSlash);
    forms.add(identity);
    forms.add(stripGitSuffix(identity));
  }
  if (options.basename && !isScopedName(noSlash)) {
    forms.add(basenameToken(noSlash));
    if (local !== noSlash) forms.add(basenameToken(local));
  }
}

/** Forms used when matching a user-supplied package target. */
function targetIdentityForms(name: string): Set<string> {
  const forms = new Set<string>();
  const raw = stripTrailingSlashes(name.trim());
  if (!raw) return forms;
  addTokenForms(forms, raw, { basename: false, repoIdentity: true });
  const local = localStripped(raw);
  const pathLike = /^(?:\.{1,2}[\\/]|[\\/]|~[\\/])/.test(raw);
  // Short names match an entry name or basename; URLs/refs/aliases do not.
  if (local !== raw || pathLike) {
    forms.add(basenameToken(local !== raw ? local : raw));
  }
  return forms;
}

const MANIFEST_IDENTITY_FIELDS = [
  "alias",
  "name",
  "id",
  "git",
  "path",
  "registry",
  "marketplace",
  "spec",
] as const;

const LOCK_IDENTITY_FIELDS = [
  "name",
  "repo_url",
  "materialization_repo_url",
  "path",
  "local_path",
  "id",
] as const;

function stringRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function fieldStrings(record: Record<string, unknown>, fields: readonly string[]): string[] {
  return fields
    .map((field) => record[field])
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

/** All exact identity forms declared by a manifest dependency entry. */
function manifestEntryIdentityForms(entry: DependencyEntry): Set<string> {
  const forms = new Set<string>();
  if (typeof entry === "string") {
    addTokenForms(forms, entry, { basename: true, repoIdentity: true });
    return forms;
  }
  const obj = stringRecord(entry);
  for (const value of fieldStrings(obj, MANIFEST_IDENTITY_FIELDS)) {
    addTokenForms(forms, value, { basename: true, repoIdentity: true });
  }
  if (typeof obj.local === "string") {
    addTokenForms(forms, obj.local, { basename: true, repoIdentity: true });
  }
  return forms;
}

/**
 * Strong forms for linking a manifest entry to a lock entry. Path-like fields
 * are intentionally excluded here and compared by basename separately, so a
 * `./foo` path cannot link to an unrelated remote `foo` package.
 */
function manifestEntryStrictForms(entry: DependencyEntry): Set<string> {
  const forms = new Set<string>();
  if (typeof entry === "string") {
    addTokenForms(forms, entry, { basename: false, repoIdentity: true });
    return forms;
  }
  const obj = stringRecord(entry);
  for (const value of fieldStrings(obj, [
    "alias",
    "name",
    "id",
    "git",
    "registry",
    "marketplace",
    "spec",
  ])) {
    addTokenForms(forms, value, { basename: false, repoIdentity: true });
  }
  return forms;
}

function lockIdentityForms(dep: LockedDependency): Set<string> {
  const forms = new Set<string>();
  for (const value of fieldStrings(stringRecord(dep), LOCK_IDENTITY_FIELDS)) {
    addTokenForms(forms, value, { basename: true, repoIdentity: true });
  }
  return forms;
}

function lockStrictForms(dep: LockedDependency): Set<string> {
  const forms = new Set<string>();
  for (const value of fieldStrings(stringRecord(dep), [
    "name",
    "repo_url",
    "materialization_repo_url",
    "id",
  ])) {
    addTokenForms(forms, value, { basename: false, repoIdentity: true });
  }
  return forms;
}

function intersects(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  for (const value of a) {
    if (b.has(value)) return true;
  }
  return false;
}

function manifestMatchesTarget(entry: DependencyEntry, target: Set<string>): boolean {
  return intersects(manifestEntryIdentityForms(entry), target);
}

function lockMatchesTarget(dep: LockedDependency, target: Set<string>): boolean {
  return intersects(lockIdentityForms(dep), target);
}

function manifestPathValues(entry: DependencyEntry): string[] {
  if (!entry || typeof entry !== "object") return [];
  const obj = stringRecord(entry);
  return [obj.path, obj.local].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}

/** Basenames a local/path lock entry can be addressed by. */
function lockPathBasenames(dep: LockedDependency): Set<string> {
  const names = new Set<string>();
  const record = stringRecord(dep);
  for (const key of ["path", "local_path"] as const) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) names.add(basenameToken(value));
  }
  const repo = String(dep.repo_url ?? "");
  const local = localStripped(repo);
  if (local !== repo && local.length > 0) names.add(basenameToken(local));
  return names;
}

function manifestEntryLinksToLock(entry: DependencyEntry, dep: LockedDependency): boolean {
  if (intersects(manifestEntryStrictForms(entry), lockStrictForms(dep))) return true;
  const paths = manifestPathValues(entry);
  if (paths.length === 0) return false;
  const lockNames = lockPathBasenames(dep);
  return paths.some((path) => lockNames.has(basenameToken(path)));
}

function filterApm(
  apm: DependencyEntry[],
  targets: Set<string>[],
  removedLockDeps: LockedDependency[],
): DependencyEntry[] {
  return apm.filter((entry) => {
    if (targets.some((target) => manifestMatchesTarget(entry, target))) return false;
    return !removedLockDeps.some((dep) => manifestEntryLinksToLock(entry, dep));
  });
}

function parentNames(resolvedBy: unknown): string[] {
  const raw = Array.isArray(resolvedBy)
    ? resolvedBy.map(String)
    : typeof resolvedBy === "string"
      ? [resolvedBy]
      : [];
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

function collectRemovals(
  lockDeps: LockedDependency[],
  directDeps: LockedDependency[],
): Set<string> {
  const remove = new Set<string>();
  for (const dep of directDeps) {
    const name = String(dep.name ?? "");
    if (name) remove.add(name);
  }

  // Orphaned transitives: keep only packages that still have a kept parent.
  let changed = true;
  while (changed) {
    changed = false;
    for (const dep of lockDeps) {
      const name = String(dep.name ?? "");
      if (!name || remove.has(name)) continue;
      const parents = parentNames(dep.resolved_by);
      const packageParents = parents.filter((parent) =>
        lockDeps.some((candidate) => String(candidate.name ?? "") === parent),
      );
      const depth = Number(stringRecord(dep).depth);
      const isTransitive =
        (Number.isFinite(depth) && depth > 1) || parents.length > 1 || packageParents.length > 0;
      if (!isTransitive) continue;
      const hasKeptParent = packageParents.some((parent) => !remove.has(parent));
      if (!hasKeptParent) {
        remove.add(name);
        changed = true;
      }
    }
  }

  return remove;
}
