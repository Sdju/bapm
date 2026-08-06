import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PackError } from "./errors.ts";
import { SafeExtractError, safeExtractZip } from "./safeExtract.ts";
import type { ExtractPackArchiveOptions, ExtractPackArchiveResult } from "./types.ts";

/**
 * Extract a pack-produced plain zip into an output directory.
 * Expects dual-read manifest at archive root after extract.
 * Uses shared safe-extract (symlink / path-escape / caps / fail-closed cleanup).
 */
export async function extractPackArchive(
  options: ExtractPackArchiveOptions = {},
): Promise<ExtractPackArchiveResult> {
  const archivePath = resolve(options.archivePath ?? options.path ?? "");
  if (!options.archivePath && !options.path) {
    throw new PackError("PACK_EXTRACT", "extractPackArchive requires archivePath or path");
  }

  const outputDir = resolve(options.outputDir ?? options.dest ?? options.cwd ?? process.cwd());

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(readFileSync(archivePath));
  } catch (cause) {
    throw new PackError("PACK_EXTRACT", `Cannot read archive: ${archivePath}`, {
      path: archivePath,
      cause,
    });
  }

  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new PackError("PACK_EXTRACT", `Not a valid zip archive: ${archivePath}`, {
      path: archivePath,
    });
  }

  try {
    const result = safeExtractZip(bytes, outputDir);
    return { ok: true, outputDir: result.dest, filesExtracted: result.filesExtracted };
  } catch (cause) {
    if (cause instanceof SafeExtractError) {
      throw new PackError("PACK_EXTRACT", cause.message, {
        path: cause.path ?? archivePath,
        cause,
      });
    }
    throw new PackError("PACK_EXTRACT", `Failed to extract zip archive: ${archivePath}`, {
      path: archivePath,
      cause,
    });
  }
}

/** Aliases for acceptance helpers. */
export const unpackArchive = extractPackArchive;
export const extractPack = extractPackArchive;
