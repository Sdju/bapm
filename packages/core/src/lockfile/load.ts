import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { BAPM_LOCK_FILE, discoverLockfilePath } from "./discover.ts";
import { LockfileError } from "./errors.ts";
import { loadLockfileYaml, parseLockfileDocument } from "./parse.ts";
import { serializeLockfile } from "./serialize.ts";
import type {
  LoadLockfileOptions,
  LoadLockfileResult,
  LockfileInput,
  WriteLockfileOptions,
} from "./types.ts";

/**
 * Discover → read file → safe YAML → validate.
 * Does not resolve, download, or install.
 */
export function loadLockfile(options: LoadLockfileOptions = {}): LoadLockfileResult {
  const discovered = discoverLockfilePath(options);

  let text: string;
  try {
    text = readFileSync(discovered.path, "utf8");
  } catch (cause) {
    throw new LockfileError(
      "LOCKFILE_MISSING_FILE",
      `Lockfile file not found: ${discovered.path}`,
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

/**
 * Like `loadLockfile`, but returns `null` when neither brand file exists.
 * Dual-conflict and corrupt/invalid files still throw.
 */
export function loadLockfileOrNull(options: LoadLockfileOptions = {}): LoadLockfileResult | null {
  try {
    return loadLockfile(options);
  } catch (error) {
    if (error instanceof LockfileError && error.code === "LOCKFILE_NOT_FOUND") {
      return null;
    }
    throw error;
  }
}

/**
 * Write lockfile YAML to disk.
 * - Explicit `path` wins
 * - Else write-back to `sourcePath` / `sourceFilename` when provided
 * - Else fresh create → `bapm.lock.yaml` under `cwd`
 */
export function writeLockfile(document: LockfileInput, options: WriteLockfileOptions = {}): string {
  const cwd = resolve(options.cwd ?? process.cwd());
  let dest: string;

  if (options.path !== undefined) {
    dest = resolve(options.path);
  } else if (options.sourcePath !== undefined) {
    dest = resolve(options.sourcePath);
  } else if (options.sourceFilename !== undefined) {
    dest = join(cwd, options.sourceFilename);
  } else {
    dest = join(cwd, BAPM_LOCK_FILE);
  }

  const yaml = serializeLockfile(document);
  writeFileSync(dest, yaml, "utf8");
  return dest;
}
