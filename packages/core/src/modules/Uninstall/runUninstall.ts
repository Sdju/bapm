import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  loadManifest,
  writeManifest,
  type DependencyEntry,
  type ObjectDependency,
} from "@/modules/Manifest";
import { loadLockfileOrNull, writeLockfile, type LockedDependency } from "@/modules/Lockfile";
import { cleanupOrphanDeployedFiles } from "@/modules/Install";
import { APM_MODULES_DIR } from "@/modules/Resolver";
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
  const loadedLock = loadLockfileOrNull({ cwd });
  const lockDeps = loadedLock?.document.dependencies ?? [];

  const toRemove = new Set<string>();
  for (const name of targets) {
    const found =
      matchesManifest(loadedManifest.document.dependencies?.apm, name) ||
      matchesManifest(loadedManifest.document.devDependencies?.apm, name) ||
      lockDeps.some((d) => depMatchesName(d, name));
    if (!found) {
      throw new UninstallError("UNINSTALL_UNKNOWN", `Package not found / not installed: ${name}`, {
        details: { name },
      });
    }
    toRemove.add(name);
  }

  // Collect lock names to remove (direct + orphaned transitives resolved_by only those)
  const removeLockNames = collectRemovals(lockDeps, toRemove);
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
      apm: filterApm(doc.dependencies.apm, toRemove),
    };
  }
  if (doc.devDependencies?.apm) {
    doc.devDependencies = {
      ...doc.devDependencies,
      apm: filterApm(doc.devDependencies.apm, toRemove),
    };
  }
  writeManifest(doc, {
    cwd,
    sourcePath: loadedManifest.sourcePath,
    sourceFilename: loadedManifest.sourceFilename,
  });

  // Modules dirs
  for (const name of removeLockNames) {
    const dir = join(cwd, APM_MODULES_DIR, name);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
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
    writeLockfile(
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

function depMatchesName(d: LockedDependency, name: string): boolean {
  const n = String(d.name ?? "");
  const repo = String(d.repo_url ?? "");
  return n === name || n.includes(name) || repo.includes(name) || repo.endsWith(`/${name}`);
}

function matchesManifest(apm: DependencyEntry[] | undefined, name: string): boolean {
  if (!Array.isArray(apm)) return false;
  return apm.some((entry) => entryName(entry) === name || entryName(entry).includes(name));
}

function entryName(entry: DependencyEntry): string {
  if (typeof entry === "string") return entry.split("/").pop() ?? entry;
  const obj = entry as ObjectDependency;
  if (obj.alias) return String(obj.alias);
  if (obj.path) {
    const p = String(obj.path).replace(/^\.\//, "");
    return p.split("/").filter(Boolean).pop() ?? p;
  }
  if (obj.git) {
    return (
      String(obj.git)
        .replace(/\.git$/i, "")
        .split("/")
        .filter(Boolean)
        .pop() ?? "dep"
    );
  }
  if (obj.id) return String(obj.id);
  return "dep";
}

function filterApm(apm: DependencyEntry[], remove: Set<string>): DependencyEntry[] {
  return apm.filter((entry) => {
    const n = entryName(entry);
    return ![...remove].some((r) => n === r || n.includes(r) || r.includes(n));
  });
}

function collectRemovals(lockDeps: LockedDependency[], direct: Set<string>): Set<string> {
  const remove = new Set<string>();
  for (const d of lockDeps) {
    const name = String(d.name ?? "");
    if (!name) continue;
    if ([...direct].some((r) => depMatchesName(d, r))) {
      remove.add(name);
    }
  }

  // Orphaned transitives: resolved_by only points into remove set
  let changed = true;
  while (changed) {
    changed = false;
    for (const d of lockDeps) {
      const name = String(d.name ?? "");
      if (!name || remove.has(name)) continue;
      const by = d.resolved_by;
      const parents = Array.isArray(by)
        ? by.map(String)
        : typeof by === "string"
          ? by.split("->").map((s) => s.trim())
          : [];
      if (parents.length === 0) continue;
      const allParentsRemoved = parents.every(
        (p) => remove.has(p) || [...remove].some((r) => p.includes(r)),
      );
      const anyParentKept = parents.some(
        (p) =>
          lockDeps.some((x) => String(x.name ?? "") === p && !remove.has(p)) ||
          [...direct].every((r) => p !== r && !p.includes(r)),
      );
      // If resolved_by lists only removed packages, drop as orphan
      if (allParentsRemoved && !anyParentKept) {
        remove.add(name);
        changed = true;
      }
    }
  }

  return remove;
}
