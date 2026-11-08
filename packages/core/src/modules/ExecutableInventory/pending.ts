import { existsSync, statSync } from "node:fs";
import { basename, isAbsolute, resolve } from "node:path";
import {
  loadUserExecutableGrants,
  parseExecutableGrants,
  resolveExecutableTrust,
  userGrantsToSurface,
  type ExecutableGrantSurface,
  type OrgExecutables,
  type UserExecutableGrants,
} from "@/modules/ExecutableTrust";
import { discoverPackageBinFiles } from "@/modules/Install";
import { locateGitPackageTree, loadEffectiveLockfileOrNull } from "@/modules/Lockfile";
import type { LockedDependency } from "@/modules/Lockfile";
import { loadManifest, ManifestError, type BapmManifest } from "@/modules/Manifest";
import { listMcpInventory } from "@/modules/Mcp";
import { runPolicyGate } from "@/modules/Policy";
import { discoverPrimitives } from "@/modules/Primitives";
import {
  EXECUTABLE_TYPE_ORDER,
  type ExecutableType,
  type PendingExecutablePackage,
  type PendingExecutablesOptions,
  type PendingExecutablesResult,
} from "./types.ts";

type PackageRoot = { name: string; root: string };

type TrustInputs = {
  projectSurface: ExecutableGrantSurface;
  userSurface: ExecutableGrantSurface;
  orgExecutables: OrgExecutables;
  surfacePresent: boolean;
};

/**
 * List dependency executable packages with no explicit allow/deny decision in
 * the project manifest, user config, or org policy.
 *
 * Sources are the effective lock + manifest:
 * - MCP from the shared `mcp_servers` inventory (and direct manifest declarations,
 *   though direct/root servers are not approval candidates)
 * - `bin` from materialized dependency package roots (`bin/*`)
 * - `hook` from dependency primitives discovered by the shared Primitives rules
 *
 * Read-only: no lock, manifest, module, or user-config writes.
 */
export function listPendingExecutablePackages(
  options: PendingExecutablesOptions = {},
): PendingExecutablesResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  const lock = loadEffectiveLockfileOrNull({ cwd });
  const manifest = loadManifestOrNull(cwd);
  const user = loadUserExecutableGrants(
    options.configRoot !== undefined ? { configRoot: options.configRoot } : {},
  );

  const trust = buildTrustInputs({
    cwd,
    manifest: manifest?.document ?? null,
    user,
    options,
  });

  const byPackage = new Map<string, Set<ExecutableType>>();
  const add = (packageName: string | null | undefined, type: ExecutableType): void => {
    const name = String(packageName ?? "").trim();
    if (!name) return;
    const types = byPackage.get(name) ?? new Set<ExecutableType>();
    types.add(type);
    byPackage.set(name, types);
  };

  // MCP: shared lock/manifest inventory. Root-owned servers need no approval.
  const inventory = listMcpInventory({
    cwd,
    ...(options.configRoot !== undefined ? { configRoot: options.configRoot } : {}),
  });
  for (const server of inventory.servers) {
    if (server.origin !== "dependency") continue;
    add(server.package, "mcp");
  }

  // bin/hook: only materialized dependency roots can be inspected read-only.
  const roots = collectDependencyRoots(
    cwd,
    lock?.document.dependencies ?? [],
    manifest?.document ?? null,
  );
  for (const entry of roots) {
    if (discoverPackageBinFiles(entry.root).length > 0) add(entry.name, "bin");
    if (packageHasHooks(cwd, entry.root)) add(entry.name, "hook");
  }

  // No resolvable lock roots: still surface dependency hooks from the modules tree.
  if (roots.length === 0) {
    for (const primitive of discoverPrimitives({ cwd })) {
      if (primitive.type !== "hook") continue;
      if (!primitive.source.startsWith("dependency:")) continue;
      add(primitive.packageName ?? primitive.source.slice("dependency:".length), "hook");
    }
  }

  const pending: PendingExecutablePackage[] = [];
  for (const packageName of [...byPackage.keys()].sort((left, right) =>
    left.localeCompare(right),
  )) {
    const types = byPackage.get(packageName)!;
    const unapproved = EXECUTABLE_TYPE_ORDER.filter((type) => {
      if (!types.has(type)) return false;
      const decision = resolveExecutableTrust({
        packageName,
        executableType: type,
        orgExecutables: trust.orgExecutables,
        projectSurface: trust.projectSurface,
        userSurface: trust.userSurface,
      });
      return decision.outcome !== "allow" && decision.outcome !== "deny";
    });
    if (unapproved.length === 0) continue;

    const label = unapproved.join(", ");
    const suffix = trust.surfacePresent ? "" : " (no project/user grant surface)";
    pending.push({
      package: packageName,
      types: unapproved,
      reason: `unapproved executable types (${label}): not in project/user/org allow or deny grants${suffix}`,
    });
  }

  return {
    lockfile: lock?.sourcePath ?? null,
    manifest: manifest?.sourcePath ?? null,
    pending,
  };
}

function buildTrustInputs(args: {
  cwd: string;
  manifest: BapmManifest | null;
  user: UserExecutableGrants;
  options: PendingExecutablesOptions;
}): TrustInputs {
  const projectSurface = args.manifest
    ? parseExecutableGrants({ manifest: args.manifest as Record<string, unknown> })
    : parseExecutableGrants({});
  const userSurface = userGrantsToSurface(args.user);
  return {
    projectSurface,
    userSurface,
    orgExecutables: loadOrgExecutables({
      cwd: args.cwd,
      policyPath: args.options.policyPath,
      noPolicy: args.options.noPolicy === true,
      noRepoPolicy: args.options.noRepoPolicy === true,
    }),
    surfacePresent: projectSurface.present || userSurface.present,
  };
}

function loadManifestOrNull(cwd: string): { document: BapmManifest; sourcePath: string } | null {
  try {
    const loaded = loadManifest({ cwd });
    return { document: loaded.document, sourcePath: loaded.sourcePath };
  } catch (error) {
    if (
      error instanceof ManifestError &&
      (error.code === "MANIFEST_NOT_FOUND" || error.code === "MANIFEST_MISSING_FILE")
    ) {
      return null;
    }
    throw error;
  }
}

function collectDependencyRoots(
  cwd: string,
  dependencies: LockedDependency[],
  manifest: BapmManifest | null,
): PackageRoot[] {
  const manifestName = stringOrNull(manifest?.name);
  const seen = new Set<string>();
  const roots: PackageRoot[] = [];

  for (const dep of dependencies) {
    const root = resolveDependencyRoot(cwd, dep);
    if (!root || !existsSync(root) || !statSync(root).isDirectory()) continue;
    if (resolve(root) === cwd) continue;
    const name = stringOrNull(dep.name) ?? basename(root);
    if (!name || name === manifestName) continue;
    const key = `${name}\u0000${resolve(root)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    roots.push({ name, root });
  }
  return roots;
}

function resolveDependencyRoot(cwd: string, dep: LockedDependency): string | undefined {
  if (isLocalLockEntry(dep)) {
    for (const field of ["local_path", "path", "anchored_local_path"] as const) {
      const value = dep[field];
      if (typeof value !== "string" || value.trim() === "") continue;
      const candidate = isAbsolute(value) ? value : resolve(cwd, value);
      if (existsSync(candidate)) return candidate;
    }
  }
  return locateGitPackageTree(cwd, dep);
}

function isLocalLockEntry(dep: LockedDependency): boolean {
  const repo = String(dep.repo_url ?? "");
  return (
    dep.source === "local" ||
    repo.startsWith("local:") ||
    repo.startsWith("_local/") ||
    (typeof dep.local_path === "string" && dep.local_path.length > 0)
  );
}

function packageHasHooks(cwd: string, root: string): boolean {
  return discoverPrimitives({ cwd, packageRoots: [root] }).some(
    (primitive) => primitive.type === "hook",
  );
}

function loadOrgExecutables(args: {
  cwd: string;
  policyPath?: string;
  noPolicy: boolean;
  noRepoPolicy: boolean;
}): OrgExecutables {
  if (args.noPolicy) return { deny_all: false, deny: [] };
  try {
    const gate = runPolicyGate({
      cwd: args.cwd,
      policyPath: args.policyPath,
      policy: args.policyPath,
      noPolicy: false,
      noRepoPolicy: args.noRepoPolicy,
      candidates: [],
    });
    if (gate.skipped || !gate.document?.executables) {
      return { deny_all: false, deny: [] };
    }
    return {
      deny_all: gate.document.executables.deny_all === true,
      deny: Array.isArray(gate.document.executables.deny) ? gate.document.executables.deny : [],
    };
  } catch {
    // Read-only view is best-effort; install still owns fail-closed policy handling.
    return { deny_all: false, deny: [] };
  }
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
