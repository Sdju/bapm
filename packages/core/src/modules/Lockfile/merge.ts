/**
 * Merge shared + personal lock documents into one effective graph.
 */
import { LockfileError } from "./errors.ts";
import { normalizePackageRepoUrl } from "./identity.ts";
import type { LockedDependency, LockfileDocument, LockfileInput } from "./types.ts";

export type MergeLockDocumentsOptions = {
  sharedPath?: string;
  personalPath?: string;
};

/**
 * Union dependencies by identity (`repo_url`) / package `name`.
 * Fail closed when the same identity or name appears on both sides with conflicting content.
 */
export function mergeLockDocuments(
  shared: LockfileInput | null | undefined,
  personal: LockfileInput | null | undefined,
  options: MergeLockDocumentsOptions = {},
): LockfileDocument {
  const sharedDoc = normalizeDoc(shared);
  const personalDoc = normalizeDoc(personal);

  const sharedDeps = Array.isArray(sharedDoc.dependencies) ? sharedDoc.dependencies : [];
  const personalDeps = Array.isArray(personalDoc.dependencies) ? personalDoc.dependencies : [];

  const byIdentity = new Map<string, LockedDependency>();
  const byName = new Map<string, LockedDependency>();
  const merged: LockedDependency[] = [];

  const absorb = (dep: LockedDependency) => {
    const identity = identityKey(dep);
    const name = typeof dep.name === "string" && dep.name.trim() ? dep.name.trim() : undefined;

    if (identity) {
      const existing = byIdentity.get(identity);
      if (existing) {
        if (!depsContentEqual(existing, dep)) {
          throwMergeConflict({
            identity,
            name,
            sharedPath: options.sharedPath,
            personalPath: options.personalPath,
          });
        }
        return;
      }
    }

    if (name) {
      const existingByName = byName.get(name);
      if (existingByName) {
        const existingId = identityKey(existingByName);
        if (existingId !== identity || !depsContentEqual(existingByName, dep)) {
          throwMergeConflict({
            identity: identity || name,
            name,
            sharedPath: options.sharedPath,
            personalPath: options.personalPath,
          });
        }
        return;
      }
    }

    merged.push(dep);
    if (identity) byIdentity.set(identity, dep);
    if (name) byName.set(name, dep);
  };

  for (const dep of sharedDeps) absorb(dep);
  for (const dep of personalDeps) absorb(dep);

  const lockfile_version =
    sharedDoc.lockfile_version === "2" || personalDoc.lockfile_version === "2" ? "2" : "1";

  const document: LockfileDocument = {
    lockfile_version,
    dependencies: merged,
  };

  // Prefer shared top-level bags / carry-forward; personal is deps-focused.
  for (const [key, value] of Object.entries(sharedDoc)) {
    if (key === "dependencies" || key === "lockfile_version") continue;
    if (value === undefined || value === null) continue;
    document[key] = value;
  }
  if (sharedDoc.generated_at === undefined && typeof personalDoc.generated_at === "string") {
    document.generated_at = personalDoc.generated_at;
  }

  return document;
}

function normalizeDoc(input: LockfileInput | null | undefined): LockfileDocument {
  if (!input || typeof input !== "object") {
    return { lockfile_version: "1", dependencies: [] };
  }
  const doc = input as LockfileDocument;
  return {
    ...doc,
    lockfile_version: doc.lockfile_version === "2" ? "2" : "1",
    dependencies: Array.isArray(doc.dependencies) ? doc.dependencies : [],
  };
}

export function identityKey(dep: LockedDependency | Record<string, unknown>): string {
  const repo = typeof dep.repo_url === "string" ? dep.repo_url : "";
  if (!repo) return "";
  const source = typeof dep.source === "string" ? dep.source : undefined;
  return normalizePackageRepoUrl(repo, { source });
}

function throwMergeConflict(args: {
  identity: string;
  name?: string;
  sharedPath?: string;
  personalPath?: string;
}): never {
  const sharedPath = args.sharedPath ?? "bapm.lock.yaml";
  const personalPath = args.personalPath ?? "bapm.local.lock.yaml";
  const label = args.name ? `${args.name} (${args.identity})` : args.identity;
  throw new LockfileError(
    "LOCKFILE_MERGE_CONFLICT",
    `Lock identity conflict between ${sharedPath} and ${personalPath}: ${label}. ` +
      `repo_url / name appears in both files with different pin content.`,
    {
      details: {
        identity: args.identity,
        name: args.name,
        sharedPath,
        personalPath,
      },
    },
  );
}

function depsContentEqual(a: LockedDependency, b: LockedDependency): boolean {
  return deepEqual(plainDep(a), plainDep(b));
}

function plainDep(dep: LockedDependency): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(dep)) {
    if (v === undefined || v === null) continue;
    out[k] = v;
  }
  return out;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
    for (const key of keys) {
      if (!deepEqual(ao[key], bo[key])) return false;
    }
    return true;
  }
  return false;
}
