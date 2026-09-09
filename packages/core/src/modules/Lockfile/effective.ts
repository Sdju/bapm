/**
 * Effective (shared ∪ personal) lock load for full-graph consumers.
 */
import { join, resolve } from "node:path";
import { BAPM_LOCK_FILE } from "./discover.ts";
import { LockfileError } from "./errors.ts";
import { loadLockfile, loadLockfileOrNull } from "./load.ts";
import { mergeLockDocuments } from "./merge.ts";
import {
  assertNoUnsupportedPersonalLockBrand,
  BAPM_PERSONAL_LOCK_FILE,
  loadPersonalLockfileOrNull,
} from "./personal.ts";
import type { LoadLockfileOptions, LoadLockfileResult, LockfileDocument } from "./types.ts";

export type LoadEffectiveLockfileOptions = LoadLockfileOptions & {
  /** When true, missing shared is treated as empty (personal-only ok). */
  allowMissingShared?: boolean;
};

/**
 * Load shared + personal, refuse unsupported brand, merge into effective document.
 * Throws LOCKFILE_NOT_FOUND only when both halves are absent (and allowMissingShared is false
 * for the OrNull path — see `loadEffectiveLockfileOrNull`).
 */
export function loadEffectiveLockfile(
  options: LoadEffectiveLockfileOptions = {},
): LoadLockfileResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  assertNoUnsupportedPersonalLockBrand(cwd);

  let shared: LoadLockfileResult | null;
  if (options.path !== undefined) {
    shared = loadLockfile(options);
  } else {
    shared = loadLockfileOrNull({ cwd });
  }

  const personal = loadPersonalLockfileOrNull({ cwd });

  if (!shared && !personal) {
    throw new LockfileError(
      "LOCKFILE_NOT_FOUND",
      `No lockfile found in ${cwd}: neither shared lock nor ${BAPM_PERSONAL_LOCK_FILE} is present.`,
      { path: cwd },
    );
  }

  const document = mergeLockDocuments(shared?.document ?? null, personal?.document ?? null, {
    sharedPath: shared?.sourceFilename ?? BAPM_LOCK_FILE,
    personalPath: BAPM_PERSONAL_LOCK_FILE,
  });

  return {
    document,
    sourcePath: shared?.sourcePath ?? join(cwd, BAPM_LOCK_FILE),
    sourceFilename: shared?.sourceFilename ?? BAPM_LOCK_FILE,
  };
}

/**
 * Like `loadEffectiveLockfile`, but returns null when neither shared nor personal exists.
 * Dual-conflict / unsupported personal brand / corrupt files still throw.
 */
export function loadEffectiveLockfileOrNull(
  options: LoadEffectiveLockfileOptions = {},
): LoadLockfileResult | null {
  const cwd = resolve(options.cwd ?? process.cwd());
  assertNoUnsupportedPersonalLockBrand(cwd);

  const shared = options.path !== undefined ? loadLockfile(options) : loadLockfileOrNull({ cwd });
  const personal = loadPersonalLockfileOrNull({ cwd });
  if (!shared && !personal) return null;

  const document = mergeLockDocuments(shared?.document ?? null, personal?.document ?? null, {
    sharedPath: shared?.sourceFilename ?? BAPM_LOCK_FILE,
    personalPath: BAPM_PERSONAL_LOCK_FILE,
  });

  return {
    document,
    sourcePath: shared?.sourcePath ?? join(cwd, BAPM_LOCK_FILE),
    sourceFilename: shared?.sourceFilename ?? BAPM_LOCK_FILE,
  };
}

/** Alias names for acceptance pickExport. */
export const loadMergedLockfile = loadEffectiveLockfile;
export const mergeLoadLockfile = loadEffectiveLockfile;
export const loadLockfileMerged = loadEffectiveLockfile;

export function emptyLockDocument(): LockfileDocument {
  return { lockfile_version: "1", dependencies: [] };
}
