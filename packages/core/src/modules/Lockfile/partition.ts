/**
 * Partition effective lock graph into shared + personal files and write both.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  assertNoUnsupportedPersonalLockBrand,
  BAPM_PERSONAL_LOCK_FILE,
  isPersonalScopeDependency,
  personalLockfilePath,
  removePersonalLockfileIfExists,
  stampPersonalScope,
} from "./personal.ts";
import { writeLockfile } from "./load.ts";
import type {
  LockedDependency,
  LockfileDocument,
  LockfileInput,
  WriteLockfileOptions,
} from "./types.ts";

export type PartitionAndWriteOptions = WriteLockfileOptions & {
  /** When true (default), ensure `.gitignore` covers personal lock if written. */
  ensureGitignore?: boolean;
};

export type PartitionAndWriteResult = {
  sharedPath: string;
  personalPath: string | null;
  sharedDocument: LockfileDocument;
  personalDocument: LockfileDocument | null;
};

export type PartitionDocumentsResult = {
  shared: LockfileDocument;
  personal: LockfileDocument | null;
};

/**
 * Split dependencies: personal-scope → personal doc; rest + inventory bags → shared.
 */
export function partitionLockDocument(effective: LockfileInput): PartitionDocumentsResult {
  const doc = effective as LockfileDocument;
  const deps = Array.isArray(doc.dependencies) ? doc.dependencies : [];
  const sharedDeps: LockedDependency[] = [];
  const personalDeps: LockedDependency[] = [];

  for (const dep of deps) {
    if (isPersonalScopeDependency(dep as Record<string, unknown>)) {
      personalDeps.push(stampPersonalScope({ ...dep }) as LockedDependency);
    } else {
      sharedDeps.push(dep);
    }
  }

  const shared: LockfileDocument = {
    lockfile_version: doc.lockfile_version === "2" ? "2" : "1",
    dependencies: sharedDeps,
  };
  for (const [key, value] of Object.entries(doc)) {
    if (key === "dependencies" || key === "lockfile_version") continue;
    if (value === undefined || value === null) continue;
    shared[key] = value;
  }

  if (personalDeps.length === 0) {
    return { shared, personal: null };
  }

  const personal: LockfileDocument = {
    lockfile_version: shared.lockfile_version,
    dependencies: personalDeps,
    ...(typeof doc.generated_at === "string" ? { generated_at: doc.generated_at } : {}),
  };
  return { shared, personal };
}

/**
 * Write partitioned shared + personal locks. Empty personal → no create; clear/remove if stale.
 */
export function partitionAndWriteLockfiles(
  effective: LockfileInput,
  options: PartitionAndWriteOptions = {},
): PartitionAndWriteResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  assertNoUnsupportedPersonalLockBrand(cwd);

  const { shared, personal } = partitionLockDocument(effective);
  const sharedPath = writeLockfile(shared, {
    cwd,
    path: options.path,
    sourcePath: options.sourcePath,
    sourceFilename: options.sourceFilename,
  });

  const personalPathAbs = personalLockfilePath(cwd);
  const hadPersonal = existsSync(personalPathAbs);

  if (!personal || personal.dependencies.length === 0) {
    if (hadPersonal) {
      removePersonalLockfileIfExists(cwd);
    }
    return {
      sharedPath,
      personalPath: null,
      sharedDocument: shared,
      personalDocument: null,
    };
  }

  writeLockfile(personal, { cwd, path: personalPathAbs });

  if (options.ensureGitignore !== false) {
    ensurePersonalLockGitignored(cwd);
  }

  return {
    sharedPath,
    personalPath: personalPathAbs,
    sharedDocument: shared,
    personalDocument: personal,
  };
}

/** @alias partitionAndWriteLockfiles — acceptance / design naming */
export function partitionAndWrite(
  effective: LockfileInput,
  options: PartitionAndWriteOptions = {},
): PartitionAndWriteResult {
  return partitionAndWriteLockfiles(effective, options);
}

export function ensurePersonalLockGitignored(projectRoot: string): void {
  const root = resolve(projectRoot);
  const gitignorePath = join(root, ".gitignore");
  const pattern = BAPM_PERSONAL_LOCK_FILE;

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, "utf8");
    if (
      content.split(/\r?\n/).some((line) => {
        const t = line.trim();
        return t === pattern || t === `/${pattern}` || t === `./${pattern}`;
      })
    ) {
      return;
    }
    const prefix = content.length === 0 || content.endsWith("\n") ? "" : "\n";
    appendFileSync(gitignorePath, `${prefix}${pattern}\n`, "utf8");
    return;
  }

  writeFileSync(gitignorePath, `${pattern}\n`, "utf8");
}
