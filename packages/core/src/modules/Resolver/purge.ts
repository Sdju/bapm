/**
 * lk-010: purge modules install paths before update re-download.
 */
import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { APM_MODULES_DIR } from "./constants.ts";
import { identityToCacheDir, normalizeRepoIdentity } from "./identity.ts";
import { modulesCacheDest } from "./defaults.ts";

export type PurgeInstallPathArgs = {
  cwd: string;
  /** Package names / identity basenames to purge. */
  packageNames: string[];
  /** Optional lock deps to also purge by repo identity cache dirs. */
  lockDeps?: Array<Record<string, unknown>>;
};

/**
 * Remove modules dirs for named packages (and matching identity cache trees)
 * so download materializes again even when the resolved tag is unchanged.
 */
export function purgeModulesInstallPaths(args: PurgeInstallPathArgs): string[] {
  const cwd = resolve(args.cwd);
  const root = join(cwd, APM_MODULES_DIR);
  const removed: string[] = [];
  const names = new Set(args.packageNames.map((n) => n.trim()).filter((n) => n.length > 0));

  for (const name of names) {
    const byName = join(root, name);
    if (existsSync(byName)) {
      rmSync(byName, { recursive: true, force: true });
      removed.push(byName);
    }
  }

  for (const dep of args.lockDeps ?? []) {
    const depName = typeof dep.name === "string" ? dep.name : "";
    const repo = typeof dep.repo_url === "string" ? dep.repo_url : "";
    const matchName =
      (depName && names.has(depName)) ||
      [...names].some((n) => depName.includes(n) || repo.includes(n));
    if (!matchName && names.size > 0) {
      // When names empty we do not iterate here for full purge — caller passes all names
      continue;
    }
    if (names.size > 0 && !matchName) continue;

    if (repo && !repo.startsWith("local:")) {
      const identity = normalizeRepoIdentity(repo.includes("://") ? repo : `https://${repo}`);
      const cacheDir = join(root, identityToCacheDir(identity));
      if (existsSync(cacheDir)) {
        rmSync(cacheDir, { recursive: true, force: true });
        removed.push(cacheDir);
      }
      const commit = typeof dep.resolved_commit === "string" ? dep.resolved_commit : undefined;
      if (commit) {
        const nested = modulesCacheDest(cwd, identity, commit);
        if (existsSync(nested)) {
          rmSync(nested, { recursive: true, force: true });
          removed.push(nested);
        }
      }
    }
  }

  return removed;
}
