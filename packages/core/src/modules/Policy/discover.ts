import { existsSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { APM_POLICY_FILE, BAPM_POLICY_FILE } from "./constants.ts";
import { PolicyError } from "./errors.ts";
import type { DiscoverPolicyOptions, DiscoveredPolicy } from "./types.ts";

/**
 * Resolve which local policy file to load.
 * Explicit `path` wins; otherwise exactly one of apm-policy.yml / bapm-policy.yml at cwd.
 * Neither → absent (not an error). Does not walk parent directories.
 */
export function discoverPolicyPath(options: DiscoverPolicyOptions = {}): DiscoveredPolicy {
  if (options.path !== undefined) {
    return discoverExplicit(options.path, options.cwd);
  }

  const root = resolve(options.cwd ?? process.cwd());
  const apmPath = join(root, APM_POLICY_FILE);
  const bapmPath = join(root, BAPM_POLICY_FILE);
  const hasApm = existsSync(apmPath);
  const hasBapm = existsSync(bapmPath);

  if (hasApm && hasBapm) {
    throw new PolicyError(
      "POLICY_DUAL_CONFLICT",
      `Both ${APM_POLICY_FILE} and ${BAPM_POLICY_FILE} are present; refuse to merge. ` +
        `Conflict paths: ${apmPath} and ${bapmPath}. Pass an explicit --policy path to choose one.`,
      { details: { apmPath, bapmPath } },
    );
  }

  if (hasApm) {
    return { path: apmPath, filename: APM_POLICY_FILE, found: true };
  }
  if (hasBapm) {
    return { path: bapmPath, filename: BAPM_POLICY_FILE, found: true };
  }

  return { absent: true, found: false, path: null };
}

/** Alias accepted by acceptance helpers. */
export const discoverLocalPolicyPath = discoverPolicyPath;

function discoverExplicit(pathArg: string, cwd?: string): DiscoveredPolicy {
  const absolute = isAbsolute(pathArg) ? resolve(pathArg) : resolve(cwd ?? process.cwd(), pathArg);

  // Explicit path discovery returns the path even if missing — load fails closed.
  // Existence check deferred to load so discover can report the chosen path.
  if (!existsSync(absolute)) {
    // Still return path so callers that only discover can see the override;
    // loadPolicy fails closed on missing explicit file.
    return { path: absolute, filename: basename(absolute), found: true };
  }

  return { path: absolute, filename: basename(absolute), found: true };
}
