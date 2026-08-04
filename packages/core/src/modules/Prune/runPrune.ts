import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadLockfileOrNull } from "@/modules/Lockfile";
import { APM_MODULES_DIR, identityToCacheDir, normalizeRepoIdentity } from "@/modules/Resolver";
import type { RunPruneOptions, PruneResult } from "./types.ts";

/**
 * Remove package dirs under apm_modules that are not in the lock graph.
 */
export async function runPrune(options: RunPruneOptions = {}): Promise<PruneResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const dryRun = options.dryRun === true || options["dry-run"] === true;
  const modulesRoot = join(cwd, APM_MODULES_DIR);
  const loaded = loadLockfileOrNull({ cwd });
  const allowed = new Set<string>();

  for (const dep of loaded?.document.dependencies ?? []) {
    const name = typeof dep.name === "string" ? dep.name : "";
    if (name) allowed.add(name);
    const repo = typeof dep.repo_url === "string" ? dep.repo_url : "";
    if (repo && !repo.startsWith("local:")) {
      const identity = normalizeRepoIdentity(repo.includes("://") ? repo : `https://${repo}`);
      allowed.add(identityToCacheDir(identity));
    }
    if (repo.startsWith("local:")) {
      allowed.add(repo.slice("local:".length));
      allowed.add(identityToCacheDir(repo.replace(/^local:/, "local_")));
    }
  }

  const orphans: string[] = [];
  if (existsSync(modulesRoot) && statSync(modulesRoot).isDirectory()) {
    for (const entry of readdirSync(modulesRoot)) {
      const abs = join(modulesRoot, entry);
      if (!statSync(abs).isDirectory()) continue;
      if (allowed.has(entry)) continue;
      orphans.push(entry);
    }
  }

  const text = orphans.length === 0 ? "No orphan modules" : `Orphan modules: ${orphans.join(", ")}`;

  if (dryRun) {
    return {
      ok: true,
      exitCode: 0,
      dryRun: true,
      orphans,
      removed: [],
      text,
    };
  }

  const removed: string[] = [];
  for (const name of orphans) {
    const abs = join(modulesRoot, name);
    rmSync(abs, { recursive: true, force: true });
    removed.push(name);
  }

  return {
    ok: true,
    exitCode: 0,
    dryRun: false,
    orphans,
    removed,
    text: removed.length ? `Removed orphans: ${removed.join(", ")}` : text,
  };
}

export const pruneModules = runPrune;
export const prune = runPrune;
