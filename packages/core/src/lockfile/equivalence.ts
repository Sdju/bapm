import type { LockedDependency, LockfileDocument, LockfileInput } from "./types.ts";

const IGNORED_META = new Set(["generated_at", "apm_version"]);

/**
 * Semantic equivalence ignoring `generated_at` / `apm_version` (req-lk-005).
 */
export function isSemanticallyEquivalent(a: LockfileInput, b: LockfileInput): boolean {
  const left = a as LockfileDocument;
  const right = b as LockfileDocument;
  if (left.lockfile_version !== right.lockfile_version) {
    return false;
  }

  const leftDeps = Array.isArray(left.dependencies) ? left.dependencies : [];
  const rightDeps = Array.isArray(right.dependencies) ? right.dependencies : [];
  if (!depsEquivalent(leftDeps, rightDeps)) {
    return false;
  }

  const aKeys = Object.keys(left).filter((k) => k !== "dependencies" && !IGNORED_META.has(k));
  const bKeys = Object.keys(right).filter((k) => k !== "dependencies" && !IGNORED_META.has(k));
  if (aKeys.length !== bKeys.length) {
    // Allow missing vs empty optional bags to still compare via deepEqual of present keys.
  }

  const keys = new Set([...aKeys, ...bKeys]);
  for (const key of keys) {
    if (!deepEqual(left[key], right[key])) {
      return false;
    }
  }

  return true;
}

function depsEquivalent(a: LockedDependency[], b: LockedDependency[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort(depKeyCmp).map(depPlain);
  const sortedB = [...b].sort(depKeyCmp).map(depPlain);
  return deepEqual(sortedA, sortedB);
}

function depKeyCmp(x: LockedDependency, y: LockedDependency): number {
  const repoCmp = String(x.repo_url).localeCompare(String(y.repo_url));
  if (repoCmp !== 0) return repoCmp;
  const xv = x.virtual_path == null ? "" : String(x.virtual_path);
  const yv = y.virtual_path == null ? "" : String(y.virtual_path);
  return xv.localeCompare(yv);
}

function depPlain(dep: LockedDependency): Record<string, unknown> {
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
