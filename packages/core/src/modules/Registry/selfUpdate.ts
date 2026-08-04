import { RegistryError } from "./errors.ts";
import type { CheckSelfUpdateOptions, CheckSelfUpdateResult } from "./types.ts";

const DEFAULT_PACKAGE = "bapm";

/**
 * Compare running CLI version to npm dist-tag (primary metadata source).
 * Injectable `fetchMetadata` for acceptance tests.
 */
export async function checkSelfUpdate(
  options: CheckSelfUpdateOptions = {},
): Promise<CheckSelfUpdateResult> {
  const currentVersion = (
    options.currentVersion ??
    process.env.BAPM_VERSION_OVERRIDE ??
    "0.0.0"
  ).trim();

  const unknownVersion =
    !currentVersion ||
    currentVersion === "0.0.0" ||
    currentVersion === "unknown" ||
    currentVersion === "undetermined";

  if (unknownVersion) {
    return {
      currentVersion: currentVersion || "0.0.0",
      updateAvailable: false,
      unknownVersion: true,
      message: `Cannot determine CLI version (${currentVersion || "unknown"}); skipping self-update check — will not claim latest`,
    };
  }

  const packageName =
    options.packageName ?? process.env.BAPM_SELF_UPDATE_PACKAGE ?? DEFAULT_PACKAGE;
  const distTag = options.distTag ?? process.env.BAPM_SELF_UPDATE_DIST_TAG ?? "latest";
  const registryBase = (
    options.registryUrl ??
    process.env.BAPM_SELF_UPDATE_METADATA_URL ??
    process.env.BAPM_NPM_REGISTRY ??
    process.env.npm_config_registry ??
    "https://registry.npmjs.org"
  ).replace(/\/+$/, "");

  const metaUrl = `${registryBase}/${packageName}`;

  let meta: unknown;
  try {
    if (options.fetchMetadata) {
      meta = await options.fetchMetadata(metaUrl);
    } else {
      const res = await fetch(metaUrl, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      meta = await res.json();
    }
  } catch (cause) {
    throw new RegistryError(
      "SELF_UPDATE",
      `self-update check failed fetching npm metadata from ${metaUrl}: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
  }

  const latestVersion = readDistTag(meta, distTag);
  if (!latestVersion) {
    throw new RegistryError(
      "SELF_UPDATE",
      `self-update check: npm metadata missing dist-tag "${distTag}" for ${packageName}`,
    );
  }

  const updateAvailable = compareSemverLoose(latestVersion, currentVersion) > 0;
  if (updateAvailable) {
    return {
      currentVersion,
      latestVersion,
      updateAvailable: true,
      unknownVersion: false,
      message: `Update available: ${latestVersion} (current ${currentVersion}). Upgrade with: npm i -g ${packageName}@${latestVersion}`,
    };
  }

  return {
    currentVersion,
    latestVersion,
    updateAvailable: false,
    unknownVersion: false,
    message: `Up-to-date: current ${currentVersion} matches latest ${latestVersion}`,
  };
}

function readDistTag(meta: unknown, tag: string): string | undefined {
  if (meta === null || typeof meta !== "object") return undefined;
  const distTags = (meta as { "dist-tags"?: Record<string, string> })["dist-tags"];
  if (!distTags || typeof distTags !== "object") return undefined;
  const v = distTags[tag];
  return typeof v === "string" ? v : undefined;
}

/** Simple numeric semver compare; returns >0 if a>b. */
function compareSemverLoose(a: string, b: string): number {
  const pa = a
    .replace(/^v/, "")
    .split(/[-+]/)[0]!
    .split(".")
    .map((x) => Number.parseInt(x, 10) || 0);
  const pb = b
    .replace(/^v/, "")
    .split(/[-+]/)[0]!
    .split(".")
    .map((x) => Number.parseInt(x, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}
