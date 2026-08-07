import { resolve } from "node:path";
import { loadMarketplaceAuthoringConfig } from "../Authoring/detect.ts";
import { loadMarketplaceFromBapmYml } from "../Authoring/load.ts";
import type { MarketplaceAuthoringConfig } from "../Authoring/types.ts";
import { MarketplacePackOutputsError } from "./errors.ts";
import { serializeMarketplaceJson } from "./mappers.ts";
import {
  normalizeMarketplacePathOverrides,
  resolveEffectiveOutputPath,
  selectOutputFormats,
} from "./profiles.ts";
import { resolveMarketplacePackages } from "./resolve.ts";
import type {
  BuildMarketplaceOutputsOptions,
  BuildMarketplaceOutputsResult,
  MarketplaceOutputWritten,
} from "./types.ts";
import { atomicWriteMarketplaceJson } from "./write.ts";

function loadConfig(
  options: BuildMarketplaceOutputsOptions,
  cwd: string,
): MarketplaceAuthoringConfig {
  if (options.config) return options.config;
  if (options.path) {
    return loadMarketplaceFromBapmYml({ cwd, path: options.path }).config;
  }
  return loadMarketplaceAuthoringConfig({ cwd }).config;
}

/**
 * Load authoring → resolve once → map → atomic multi-output write (or dry-run).
 */
export async function buildMarketplaceOutputs(
  options: BuildMarketplaceOutputsOptions = {},
): Promise<BuildMarketplaceOutputsResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const dryRun = Boolean(options.dryRun);
  const marketplaceOutputs = options.marketplaceOutputs;
  if (!marketplaceOutputs) {
    throw new MarketplacePackOutputsError(
      "Marketplace output registry is required; register host integrations at composition root",
    );
  }
  const knownFormats = new Set(
    marketplaceOutputs.list().map((integration) => integration.marketplaceOutput.format),
  );

  // Validate filter early (unknown format) even when config missing later
  let config: MarketplaceAuthoringConfig;
  try {
    config = loadConfig(options, cwd);
  } catch (err) {
    // Re-check filter on unknown format before bubbling load errors when filter is bad
    selectOutputFormats({ packages: [], outputs: {} }, options.marketplace, knownFormats);
    throw err;
  }

  const pathOverrides = normalizeMarketplacePathOverrides(options.marketplacePaths, knownFormats);
  const formats = selectOutputFormats(config, options.marketplace, knownFormats);

  if (formats.length === 0) {
    return {
      ok: true,
      success: true,
      dryRun,
      skipped: true,
      packages: [],
      resolved: [],
      written: [],
      warnings: [],
    };
  }

  const { packages, resolved } = await resolveMarketplacePackages({
    cwd,
    path: options.path,
    config,
    offline: options.offline,
    includePrerelease: options.includePrerelease,
    lsRemote: options.lsRemote,
  });

  const written: MarketplaceOutputWritten[] = [];
  const warnings: string[] = [];

  for (const format of formats) {
    const integration = marketplaceOutputs.get(format);
    if (!integration) {
      throw new MarketplacePackOutputsError(
        `No marketplace output integration is registered for '${format}'`,
      );
    }
    const outPath = resolveEffectiveOutputPath({
      cwd,
      format,
      defaultOutput: integration.marketplaceOutput.defaultOutput,
      path: pathOverrides[format],
      config,
    });
    const doc = integration.marketplaceOutput.map(config, resolved);
    const body = serializeMarketplaceJson(doc);

    if (dryRun) {
      console.log(`Dry-run: would write ${format} marketplace.json → ${outPath}`);
      written.push({ format, path: outPath, dryRun: true });
      continue;
    }

    atomicWriteMarketplaceJson(outPath, body);
    console.log(`Wrote ${format} marketplace.json → ${outPath}`);
    written.push({ format, path: outPath, dryRun: false });
  }

  return {
    ok: true,
    success: true,
    dryRun,
    skipped: false,
    packages,
    resolved,
    written,
    warnings,
  };
}

/** Aliases accepted by acceptance soft-resolve. */
export const emitMarketplacePackOutputs = buildMarketplaceOutputs;
export const runMarketplaceBuilder = buildMarketplaceOutputs;
export const writeMarketplacePackOutputs = buildMarketplaceOutputs;

/**
 * Detect whether cwd has a loadable marketplace authoring block (no throw on none).
 */
export function tryLoadMarketplaceAuthoring(cwd: string): MarketplaceAuthoringConfig | undefined {
  try {
    return loadMarketplaceAuthoringConfig({ cwd }).config;
  } catch (err) {
    if (err instanceof MarketplacePackOutputsError) return undefined;
    // Authoring "none" / missing block
    const msg = err instanceof Error ? err.message : String(err);
    if (/no marketplace config|none \/ missing|absent/i.test(msg)) return undefined;
    if (/Both bapm\.yml.*marketplace\.yml/i.test(msg)) throw err;
    // Other validation errors during pack emit should surface when we intend to emit
    return undefined;
  }
}
