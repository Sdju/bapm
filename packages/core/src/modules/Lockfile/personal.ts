/**
 * Personal lockfile (`bapm.local.lock.yaml`) discovery / load.
 * No parent walk-up. `apm.local.lock.yaml` is refused fail-closed in v1.
 */
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { LockfileError } from "./errors.ts";
import { loadLockfileYaml, parseLockfileDocument } from "./parse.ts";
import type { LoadLockfileOptions, LoadLockfileResult, LockfileDocument } from "./types.ts";

export const BAPM_PERSONAL_LOCK_FILE = "bapm.local.lock.yaml";
export const APM_PERSONAL_LOCK_FILE = "apm.local.lock.yaml";
export const PERSONAL_LOCK_SCOPE_KEY = "x-bapm-lock-scope";
export const PERSONAL_LOCK_SCOPE_VALUE = "local";

export type LoadPersonalLockfileOptions = LoadLockfileOptions;

/**
 * Absolute path to personal lock at project root (does not check existence).
 */
export function personalLockfilePath(cwd?: string): string {
  return join(resolve(cwd ?? process.cwd()), BAPM_PERSONAL_LOCK_FILE);
}

/**
 * Fail closed when unsupported `apm.local.lock.yaml` is present at project root.
 */
export function assertNoUnsupportedPersonalLockBrand(cwd?: string): void {
  const root = resolve(cwd ?? process.cwd());
  const apmPersonal = join(root, APM_PERSONAL_LOCK_FILE);
  if (existsSync(apmPersonal)) {
    throw new LockfileError(
      "LOCKFILE_UNSUPPORTED_PERSONAL_BRAND",
      `Unsupported personal lock brand ${APM_PERSONAL_LOCK_FILE} at ${apmPersonal}. ` +
        `Use ${BAPM_PERSONAL_LOCK_FILE} only.`,
      { path: apmPersonal, details: { filename: APM_PERSONAL_LOCK_FILE } },
    );
  }
}

/**
 * Discover personal lock at cwd root only. Returns null when absent.
 * Throws when `apm.local.lock.yaml` is present.
 */
export function discoverPersonalLockfilePath(
  options: LoadPersonalLockfileOptions = {},
): { path: string; filename: string } | null {
  assertNoUnsupportedPersonalLockBrand(options.cwd);
  if (options.path !== undefined) {
    const absolute = resolve(options.path);
    if (!existsSync(absolute)) return null;
    return { path: absolute, filename: BAPM_PERSONAL_LOCK_FILE };
  }
  const path = personalLockfilePath(options.cwd);
  if (!existsSync(path)) return null;
  return { path, filename: BAPM_PERSONAL_LOCK_FILE };
}

/**
 * Load personal lock when present; otherwise null.
 * Throws on unsupported brand, corrupt YAML, or validation errors.
 */
export function loadPersonalLockfileOrNull(
  options: LoadPersonalLockfileOptions = {},
): LoadLockfileResult | null {
  const discovered = discoverPersonalLockfilePath(options);
  if (!discovered) return null;

  let text: string;
  try {
    text = readFileSync(discovered.path, "utf8");
  } catch (cause) {
    throw new LockfileError(
      "LOCKFILE_MISSING_FILE",
      `Personal lockfile file not found: ${discovered.path}`,
      { path: discovered.path, cause },
    );
  }

  const raw = loadLockfileYaml(text, discovered.path);
  const document = parseLockfileDocument(raw);
  return {
    document,
    sourcePath: discovered.path,
    sourceFilename: discovered.filename,
  };
}

/** Alias for discover helpers used by acceptance pickExport. */
export function discoverPersonalLockfile(
  options: LoadPersonalLockfileOptions = {},
): LoadLockfileResult | null {
  return loadPersonalLockfileOrNull(options);
}

export function isPersonalScopeDependency(dep: Record<string, unknown>): boolean {
  const scope = dep[PERSONAL_LOCK_SCOPE_KEY];
  return scope === PERSONAL_LOCK_SCOPE_VALUE || scope === true;
}

export function stampPersonalScope<T extends Record<string, unknown>>(dep: T): T {
  return { ...dep, [PERSONAL_LOCK_SCOPE_KEY]: PERSONAL_LOCK_SCOPE_VALUE };
}

export function stripPersonalScopeMarker<T extends Record<string, unknown>>(dep: T): T {
  if (!(PERSONAL_LOCK_SCOPE_KEY in dep)) return dep;
  const next = { ...dep };
  delete next[PERSONAL_LOCK_SCOPE_KEY];
  return next;
}

/**
 * Remove personal lock file when empty personal scope and file should not linger.
 */
export function removePersonalLockfileIfExists(cwd?: string): void {
  const path = personalLockfilePath(cwd);
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

export type EmptyPersonalDocument = Pick<LockfileDocument, "lockfile_version" | "dependencies">;

export function emptyPersonalLockDocument(
  lockfileVersion: LockfileDocument["lockfile_version"] = "1",
): EmptyPersonalDocument {
  return { lockfile_version: lockfileVersion, dependencies: [] };
}
