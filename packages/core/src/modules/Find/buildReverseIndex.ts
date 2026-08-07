import type { LockedDependency, LockfileDocument } from "@/modules/Lockfile";
import { WORKSPACE_OWNER_KEY, type ReverseIndex } from "./types.ts";

/** Stable owner key aligned with Deps inspect (`name` else `repo_url`). */
export function packageOwnerKey(dep: LockedDependency): string {
  const name = dep.name != null ? String(dep.name).trim() : "";
  if (name) return name;
  return String(dep.repo_url ?? "").trim();
}

function addOwner(index: ReverseIndex, path: string, owner: string): void {
  if (!path || !owner) return;
  let owners = index.get(path);
  if (!owners) {
    owners = [];
    index.set(path, owners);
  }
  if (!owners.includes(owner)) owners.push(owner);
}

function addPathsFromHashes(
  index: ReverseIndex,
  hashes: Record<string, string> | undefined,
  owner: string,
): void {
  if (!hashes || typeof hashes !== "object") return;
  for (const path of Object.keys(hashes)) {
    addOwner(index, path, owner);
  }
}

function addPathsFromList(index: ReverseIndex, list: string[] | undefined, owner: string): void {
  if (!Array.isArray(list)) return;
  for (const path of list) {
    if (typeof path === "string") addOwner(index, path, owner);
  }
}

/**
 * Build reverse index: deployed path → ordered owner keys.
 * Hash-map keys are primary; `deployed_files` / `local_deployed_files` are unioned.
 * Owner order: lock dependency array order, then workspace local.
 */
export function buildReverseIndex(
  document: LockfileDocument | Record<string, unknown>,
): ReverseIndex {
  const index: ReverseIndex = new Map();
  const deps = Array.isArray(document.dependencies)
    ? (document.dependencies as LockedDependency[])
    : [];

  for (const dep of deps) {
    const owner = packageOwnerKey(dep);
    if (!owner) continue;
    addPathsFromHashes(index, dep.deployed_file_hashes, owner);
    addPathsFromList(index, dep.deployed_files, owner);
  }

  const localHashes = document.local_deployed_file_hashes as Record<string, string> | undefined;
  addPathsFromHashes(index, localHashes, WORKSPACE_OWNER_KEY);
  const localFiles = document.local_deployed_files as string[] | undefined;
  addPathsFromList(index, localFiles, WORKSPACE_OWNER_KEY);

  return index;
}

export const build_reverse_index = buildReverseIndex;
export const buildFindReverseIndex = buildReverseIndex;
