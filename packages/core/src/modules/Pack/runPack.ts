import { existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { discoverAgentPluginMcp, loadAgentPluginManifest } from "@/modules/AgentPlugins";
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
  const agentPlugins = options.agentPlugins === true;

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

  if (agentPlugins) {
    if (options.marketplace !== undefined) {
      throw new PackError(
        "PACK_VALIDATION",
        "Agent Plugins portable pack cannot emit marketplace outputs",
      );
    }
    if (options.archive === false) {
      throw new PackError(
        "PACK_VALIDATION",
        "Agent Plugins portable pack requires archive mode (pass archive: true / --archive)",
      );
    }

    let manifest;
    try {
      manifest = loadAgentPluginManifest({ root: cwd }).manifest;
      const mcpPath = join(cwd, "mcp.json");
      if (existsSync(mcpPath)) {
        const mcp = discoverAgentPluginMcp({ root: cwd, dataRoot: join(cwd, ".bapm-data") });
        const invalid = mcp.diagnostics.find((diagnostic) => diagnostic.severity === "error");
        if (invalid) throw new Error(invalid.message);
      }
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Agent Plugin portable root validation failed";
      throw new PackError("PACK_VALIDATION", message, { cause });
    }

    const entries = collectPackFiles(cwd);
    assertProjectHasContent(entries, { agentPlugins: true });
    return writePackArchive({
      options,
      cwd,
      entries,
      name: manifest.name,
      version: manifest.version ?? "0.0.0",
    });
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

    const knownFormats = new Set(
      options.marketplaceOutputs
        ?.list()
        .map((integration) => integration.marketplaceOutput.format) ?? [],
    );
    const selected = selectOutputFormats(config, marketplaceFilter, knownFormats);
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
          marketplaceOutputs: options.marketplaceOutputs,
        });
        marketplaceWritten = !built.skipped && built.written.length > 0;
      } catch (cause) {
        if (cause instanceof MarketplacePackOutputsError) {
          const message =
            cause instanceof Error ? cause.message : "Marketplace pack output validation failed";
          throw new PackError("PACK_VALIDATION", message, { cause });
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

  const packed = writePackArchive({
    options,
    cwd,
    entries,
    name: document.name,
    version: document.version,
  });
  return { ...packed, marketplaceWritten };
}

/** Alias accepted by acceptance helpers. */
export const packProject = runPack;
export const packArchive = runPack;

function writePackArchive(input: {
  options: RunPackOptions;
  cwd: string;
  entries: ReturnType<typeof collectPackFiles>;
  name: string;
  version: string;
}): RunPackResult {
  if (input.options.dryRun === true) {
    return { ok: true, dryRun: true, filesPacked: input.entries.length };
  }

  const fileMap: Record<string, Uint8Array> = {};
  for (const entry of input.entries) fileMap[entry.relativePath] = entry.bytes;
  const archivePath = resolve(
    input.options.outputPath ?? resolve(input.cwd, defaultArchiveName(input.name, input.version)),
  );
  try {
    writeFileSync(archivePath, createZipArchive(fileMap));
  } catch (cause) {
    throw new PackError("PACK_IO", `Failed to write archive: ${archivePath}`, {
      path: archivePath,
      cause,
    });
  }
  return { ok: true, dryRun: false, archivePath, filesPacked: input.entries.length };
}
