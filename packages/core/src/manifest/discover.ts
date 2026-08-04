import { existsSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { ManifestError } from "./errors.ts";
import type { DiscoverManifestOptions, DiscoveredManifest } from "./types.ts";

export const APM_MANIFEST_FILE = "apm.yml";
export const BAPM_MANIFEST_FILE = "bapm.yml";

/**
 * Resolve which manifest file to load.
 * Explicit `path` wins; otherwise exactly one of apm.yml / bapm.yml at cwd.
 * Does not walk parent directories.
 */
export function discoverManifestPath(options: DiscoverManifestOptions = {}): DiscoveredManifest {
  if (options.path !== undefined) {
    return discoverExplicit(options.path, options.cwd);
  }

  const root = resolve(options.cwd ?? process.cwd());
  const apmPath = join(root, APM_MANIFEST_FILE);
  const bapmPath = join(root, BAPM_MANIFEST_FILE);
  const hasApm = existsSync(apmPath);
  const hasBapm = existsSync(bapmPath);

  if (hasApm && hasBapm) {
    throw new ManifestError(
      "MANIFEST_DUAL_CONFLICT",
      `Both ${APM_MANIFEST_FILE} and ${BAPM_MANIFEST_FILE} are present; refuse to merge. ` +
        `Conflict paths: ${apmPath} and ${bapmPath}. Pass an explicit path to choose one.`,
      { details: { apmPath, bapmPath } },
    );
  }

  if (hasApm) {
    return { path: apmPath, filename: APM_MANIFEST_FILE };
  }
  if (hasBapm) {
    return { path: bapmPath, filename: BAPM_MANIFEST_FILE };
  }

  throw new ManifestError(
    "MANIFEST_NOT_FOUND",
    `No manifest found in ${root}: neither ${APM_MANIFEST_FILE} nor ${BAPM_MANIFEST_FILE} is present.`,
    { path: root },
  );
}

function discoverExplicit(pathArg: string, cwd?: string): DiscoveredManifest {
  const absolute = isAbsolute(pathArg) ? resolve(pathArg) : resolve(cwd ?? process.cwd(), pathArg);

  if (!existsSync(absolute)) {
    throw new ManifestError("MANIFEST_MISSING_FILE", `Manifest file not found: ${absolute}`, {
      path: absolute,
    });
  }

  return { path: absolute, filename: basename(absolute) };
}
