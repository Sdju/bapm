import { existsSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { LockfileError } from "./errors.ts";
import type { DiscoverLockfileOptions, DiscoveredLockfile } from "./types.ts";

export const APM_LOCK_FILE = "apm.lock.yaml";
export const BAPM_LOCK_FILE = "bapm.lock.yaml";

/**
 * Resolve which lockfile to load.
 * Explicit `path` wins; otherwise exactly one of apm.lock.yaml / bapm.lock.yaml at cwd.
 * Does not walk parent directories. Ignores legacy `apm.lock`.
 */
export function discoverLockfilePath(options: DiscoverLockfileOptions = {}): DiscoveredLockfile {
  if (options.path !== undefined) {
    return discoverExplicit(options.path, options.cwd);
  }

  const root = resolve(options.cwd ?? process.cwd());
  const apmPath = join(root, APM_LOCK_FILE);
  const bapmPath = join(root, BAPM_LOCK_FILE);
  const hasApm = existsSync(apmPath);
  const hasBapm = existsSync(bapmPath);

  if (hasApm && hasBapm) {
    throw new LockfileError(
      "LOCKFILE_DUAL_CONFLICT",
      `Both ${APM_LOCK_FILE} and ${BAPM_LOCK_FILE} are present; refuse to merge. ` +
        `Conflict paths: ${apmPath} and ${bapmPath}. Pass an explicit path to choose one.`,
      { details: { apmPath, bapmPath } },
    );
  }

  if (hasApm) {
    return { path: apmPath, filename: APM_LOCK_FILE };
  }
  if (hasBapm) {
    return { path: bapmPath, filename: BAPM_LOCK_FILE };
  }

  throw new LockfileError(
    "LOCKFILE_NOT_FOUND",
    `No lockfile found in ${root}: neither ${APM_LOCK_FILE} nor ${BAPM_LOCK_FILE} is present.`,
    { path: root },
  );
}

function discoverExplicit(pathArg: string, cwd?: string): DiscoveredLockfile {
  const absolute = isAbsolute(pathArg) ? resolve(pathArg) : resolve(cwd ?? process.cwd(), pathArg);

  if (!existsSync(absolute)) {
    throw new LockfileError("LOCKFILE_MISSING_FILE", `Lockfile file not found: ${absolute}`, {
      path: absolute,
    });
  }

  return { path: absolute, filename: basename(absolute) };
}
