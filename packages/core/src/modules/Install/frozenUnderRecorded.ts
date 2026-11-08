/**
 * Frozen under-record gate (P1 #5).
 *
 * Frozen mode already verifies hashes that *are* present in the lock. It did
 * not fail when a package would deploy primitives that the lock records no
 * inventory for, and it did not notice local package content drift. This gate
 * runs after primitive resolution (so it knows the would-be deploy set) and
 * before any target/harness write or lock mutation.
 */
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { type LockedDependency, type LockfileDocument } from "@/modules/Lockfile";
import { computeLocalSourceContentHash, type ResolvedNode } from "@/modules/Resolver";
import type { AttributedPrimitive } from "@/modules/Primitives";
import { InstallError } from "./errors.ts";

export type FrozenUnderRecordedOptions = {
  cwd: string;
  document: LockfileDocument;
  nodes: ResolvedNode[];
  primitives: AttributedPrimitive[];
};

type PackageGroup = {
  name: string;
  node?: ResolvedNode;
  primitives: AttributedPrimitive[];
};

/**
 * Fail closed when frozen would deploy primitives for a package whose lock row
 * has no `deployed_file_hashes` / `deployed_files`, or when a local package's
 * recorded content snapshot does not match its on-disk tree.
 */
export function assertFrozenDeployInventory(options: FrozenUnderRecordedOptions): void {
  const groups = groupPrimitivesByPackage(options);
  for (const group of groups.values()) {
    const row = findLockRow(options.document, group);
    const local = isLocalPackage(group, row);

    if (local) {
      verifyLocalContentHash(options.cwd, group, row);
    }

    if (hasDeployedInventory(row)) continue;

    const sample = samplePrimitives(options.cwd, group.primitives);
    const first = sample[0];
    throw new InstallError(
      "INSTALL_FROZEN_UNDER_RECORDED",
      `Frozen install would deploy files for package "${group.name}" that the lock does not record` +
        (first ? ` (${first})` : "") +
        ". Run `bapm install` locally and commit the lockfile so frozen deploys only recorded files.",
      {
        details: {
          package: group.name,
          reason: "missing_deployed_inventory",
          primitives: sample,
          files: group.primitives.slice(0, 5).map((p) => relativePath(options.cwd, p.path)),
        },
      },
    );
  }
}

function groupPrimitivesByPackage(options: FrozenUnderRecordedOptions): Map<string, PackageGroup> {
  const groups = new Map<string, PackageGroup>();
  const nodesByName = new Map(options.nodes.map((node) => [node.name, node]));

  for (const primitive of options.primitives) {
    // Root project primitives are not a lock dependency; only packages that
    // contribute deployable files need a recorded inventory.
    if (primitive.source === "local" && !primitive.packageName) continue;
    const name =
      primitive.packageName?.trim() ||
      (primitive.source.startsWith("dependency:")
        ? primitive.source.slice("dependency:".length)
        : "");
    if (!name) continue;

    const group = groups.get(name) ?? {
      name,
      node: nodesByName.get(name),
      primitives: [],
    };
    group.primitives.push(primitive);
    groups.set(name, group);
  }

  return groups;
}

function isLocalPackage(group: PackageGroup, row: LockedDependency | undefined): boolean {
  if (group.node?.kind === "local") return true;
  if (row?.source === "local") return true;
  const repo = String(row?.repo_url ?? group.node?.repo_url ?? "");
  if (repo.startsWith("local:") || repo.startsWith("_local/")) return true;
  return typeof row?.local_path === "string" && row.local_path.length > 0;
}

function verifyLocalContentHash(
  cwd: string,
  group: PackageGroup,
  row: LockedDependency | undefined,
): void {
  const recorded = localRecordedHash(row);
  const root = localPackageRoot(cwd, group);
  const label = `local package "${group.name}"`;

  if (!recorded) {
    throw new InstallError(
      "INSTALL_FROZEN_UNDER_RECORDED",
      `Frozen install cannot verify ${label}: lock has no content_hash/tree_sha256. ` +
        "Run `bapm install` locally and commit the lockfile.",
      { details: { package: group.name, reason: "missing_local_content_hash" } },
    );
  }

  if (!root || !existsSync(root)) {
    throw new InstallError(
      "INSTALL_FROZEN_UNDER_RECORDED",
      `Frozen install cannot verify ${label}: local package tree is missing. ` +
        "Restore the path or run `bapm install` locally and commit the lockfile.",
      { details: { package: group.name, reason: "missing_local_tree", root } },
    );
  }

  let observed: string;
  try {
    observed = computeLocalSourceContentHash(root);
  } catch (cause) {
    throw new InstallError(
      "INSTALL_FROZEN_UNDER_RECORDED",
      `Frozen install cannot re-hash ${label}: local package tree is unreadable.`,
      { cause, details: { package: group.name, reason: "unreadable_local_tree", root } },
    );
  }

  if (!hashesEqual(recorded, observed)) {
    throw new InstallError(
      "INSTALL_FROZEN_UNDER_RECORDED",
      `Frozen install detected local content changed for "${group.name}": ` +
        `recorded ${recorded}, observed ${observed}. Run \`bapm install\` locally and commit the lockfile.`,
      {
        details: {
          package: group.name,
          reason: "local_content_changed",
          expected: recorded,
          observed,
        },
      },
    );
  }
}

function localRecordedHash(row: LockedDependency | undefined): string | undefined {
  const content = typeof row?.content_hash === "string" ? row.content_hash.trim() : "";
  if (content) return content;
  const tree = typeof row?.tree_sha256 === "string" ? row.tree_sha256.trim() : "";
  return tree || undefined;
}

function localPackageRoot(cwd: string, group: PackageGroup): string | undefined {
  const candidate = group.node?.packageRoot ?? group.node?.path;
  if (!candidate) return undefined;
  return resolve(cwd, candidate);
}

function hasDeployedInventory(row: LockedDependency | undefined): boolean {
  const hashes = row?.deployed_file_hashes;
  if (hashes && typeof hashes === "object" && !Array.isArray(hashes)) {
    if (Object.keys(hashes).length > 0) return true;
  }
  const files = row?.deployed_files;
  return Array.isArray(files) && files.length > 0;
}

function findLockRow(
  document: LockfileDocument,
  group: PackageGroup,
): LockedDependency | undefined {
  const deps = document.dependencies ?? [];
  const byName = deps.find((dep) => String(dep.name ?? "") === group.name);
  if (byName) return byName;

  const node = group.node;
  if (node) {
    const repo = String(node.repo_url ?? "");
    const identity = String(node.identity ?? "");
    const byRepo = deps.find((dep) => {
      const depRepo = String(dep.repo_url ?? "");
      return (
        (repo.length > 0 && depRepo === repo) ||
        (identity.length > 0 && (depRepo === identity || depRepo === `_local/${group.name}`))
      );
    });
    if (byRepo) return byRepo;

    if (node.path) {
      const key = normalizePathKey(node.path);
      const base = key.split("/").filter(Boolean).pop() ?? key;
      const byPath = deps.find((dep) => {
        const candidates = [dep.path, dep.local_path]
          .filter((value): value is string => typeof value === "string")
          .map(normalizePathKey);
        return candidates.some(
          (candidate) => candidate === key || candidate === base || candidate.endsWith(`/${base}`),
        );
      });
      if (byPath) return byPath;
    }
  }

  return undefined;
}

function samplePrimitives(cwd: string, primitives: AttributedPrimitive[]): string[] {
  return primitives.slice(0, 5).map((primitive) => {
    const type = primitive.type ? `${primitive.type}:` : "";
    const path = relativePath(cwd, primitive.path);
    return path ? `${type}${primitive.name} (${path})` : `${type}${primitive.name}`;
  });
}

function relativePath(cwd: string, target: string | undefined): string | undefined {
  if (!target) return undefined;
  const rel = relative(resolve(cwd), resolve(cwd, target));
  return rel.replaceAll("\\", "/");
}

function normalizePathKey(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

function hashesEqual(recorded: string, observed: string): boolean {
  return canonicalHash(recorded) === canonicalHash(observed);
}

function canonicalHash(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (/^[0-9a-f]{64}$/.test(trimmed)) return `sha256:${trimmed}`;
  return trimmed;
}
