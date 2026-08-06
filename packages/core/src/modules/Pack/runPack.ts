import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadManifest } from "@/modules/Manifest";
import {
  buildMarketplaceOutputs,
  detectAuthoringConfigSource,
  loadMarketplaceAuthoringConfig,
  MarketplacePackOutputsError,
  selectOutputFormats,
  tryLoadMarketplaceAuthoring,
} from "@/modules/Marketplace";
import { checkReleaseTag } from "./checkRelease.ts";
import {
  assertProjectHasContent,
  collectPackFiles,
  defaultArchiveName,
  ensureCwdExists,
} from "./collect.ts";
import { PackError } from "./errors.ts";
import type { RunPackOptions, RunPackResult } from "./types.ts";
import { createZipArchive } from "./zip.ts";

function manifestHasDependenciesBlock(document: Record<string, unknown>): boolean {
  return "dependencies" in document || "devDependencies" in document;
}

function hasMarketplaceAuthoring(cwd: string): boolean {
  const detected = detectAuthoringConfigSource({ cwd });
  return detected.ok === true;
}

/**
 * Validate project manifest, collect pack set, refuse secrets, optionally write plain zip.
 * When marketplace authoring + outputs are selected, emit host marketplace.json (design D1–D2).
 * When `checkRelease` is set, runs pr-004 gate first (fail closed before durable zip).
 */
export async function runPack(options: RunPackOptions = {}): Promise<RunPackResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  ensureCwdExists(cwd);

  if (options.checkRelease) {
    const gate = await checkReleaseTag({ cwd, tag: options.tag });
    for (const w of gate.warnings) {
      console.error(`bapm: warning: ${w}`);
    }
  }

  const format = options.format ?? "zip";
  if (format !== "zip") {
    throw new PackError("PACK_VALIDATION", `Unsupported pack format "${format}" (M7 supports zip)`);
  }

  const dryRun = options.dryRun === true;
  const marketplaceFilter = options.marketplace;
  const wantsMarketplaceSkip =
    marketplaceFilter === "none" ||
    (Array.isArray(marketplaceFilter) && marketplaceFilter.length === 0);

  let marketplaceWritten = false;
  let marketplaceOnlyEligible = false;

  if (!wantsMarketplaceSkip && hasMarketplaceAuthoring(cwd)) {
    let config;
    try {
      config = loadMarketplaceAuthoringConfig({ cwd }).config;
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Failed to load marketplace authoring for pack";
      throw new PackError("PACK_VALIDATION", message, { cause });
    }

    const selected = selectOutputFormats(config, marketplaceFilter);
    if (selected.length > 0) {
      try {
        const built = await buildMarketplaceOutputs({
          cwd,
          config,
          marketplace: marketplaceFilter,
          marketplacePaths: options.marketplacePaths,
          dryRun,
          offline: options.offline,
          includePrerelease: options.includePrerelease,
          lsRemote: options.lsRemote,
        });
        marketplaceWritten = !built.skipped && built.written.length > 0;
      } catch (cause) {
        if (cause instanceof MarketplacePackOutputsError) {
          throw new PackError("PACK_VALIDATION", cause.message, { cause });
        }
        throw cause;
      }

      // D2: marketplace-only (no dependencies:) → skip zip / empty archive
      marketplaceOnlyEligible = true;
    }
  }

  // Validate dual-read manifest before any durable zip write.
  let document;
  try {
    ({ document } = loadManifest({ cwd }));
  } catch (cause) {
    // Marketplace-only projects may still have a valid manifest; if marketplace
    // emit already succeeded and there is no dependencies block, allow skip-zip.
    if (marketplaceWritten && marketplaceOnlyEligible) {
      const soft = tryLoadMarketplaceAuthoring(cwd);
      if (soft && !("dependencies" in (soft as object))) {
        return {
          ok: true,
          dryRun,
          filesPacked: 0,
          marketplaceWritten: true,
        };
      }
    }
    const message = cause instanceof Error ? cause.message : "Manifest validation failed for pack";
    throw new PackError("PACK_VALIDATION", message, { cause });
  }

  const hasDeps = manifestHasDependenciesBlock(document as unknown as Record<string, unknown>);
  const skipZipForMarketplaceOnly = marketplaceWritten && !hasDeps;

  if (skipZipForMarketplaceOnly) {
    return {
      ok: true,
      dryRun,
      filesPacked: 0,
      marketplaceWritten: true,
    };
  }

  const entries = collectPackFiles(cwd);
  assertProjectHasContent(entries);

  const archive = options.archive !== false;

  if (!archive) {
    // M7 MUST path is --archive; directory pack is optional and not implemented yet.
    // When marketplace JSON was written, treat as success without zip.
    if (marketplaceWritten) {
      return {
        ok: true,
        dryRun,
        filesPacked: 0,
        marketplaceWritten: true,
      };
    }
    throw new PackError(
      "PACK_VALIDATION",
      "Pack requires archive mode (pass archive: true / --archive)",
    );
  }

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      filesPacked: entries.length,
      marketplaceWritten,
    };
  }

  const fileMap: Record<string, Uint8Array> = {};
  for (const entry of entries) {
    fileMap[entry.relativePath] = entry.bytes;
  }

  const zipBytes = createZipArchive(fileMap);
  const outName = defaultArchiveName(document.name, document.version);
  const archivePath = resolve(options.outputPath ?? resolve(cwd, outName));

  try {
    writeFileSync(archivePath, zipBytes);
  } catch (cause) {
    throw new PackError("PACK_IO", `Failed to write archive: ${archivePath}`, {
      path: archivePath,
      cause,
    });
  }

  return {
    ok: true,
    dryRun: false,
    archivePath,
    filesPacked: entries.length,
    marketplaceWritten,
  };
}

/** Alias accepted by acceptance helpers. */
export const packProject = runPack;
export const packArchive = runPack;
