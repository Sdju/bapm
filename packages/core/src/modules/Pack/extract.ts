import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { PackError } from "./errors.ts";
import type { ExtractPackArchiveOptions, ExtractPackArchiveResult } from "./types.ts";
import { readZipArchive } from "./zip.ts";

/**
 * Extract a pack-produced plain zip into an output directory.
 * Expects dual-read manifest at archive root after extract.
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

  const files = readZipArchive(bytes);
  let count = 0;

  for (const [name, data] of Object.entries(files)) {
    if (!name || name.endsWith("/")) continue;
    const normalized = name.replace(/\\/g, "/");
    if (normalized.startsWith("/") || normalized.split("/").includes("..")) {
      throw new PackError("PACK_EXTRACT", `Refusing unsafe archive entry: ${name}`, {
        path: name,
      });
    }
    const dest = resolve(outputDir, normalized);
    const rel = relative(outputDir, dest);
    if (rel.startsWith("..") || rel === "..") {
      throw new PackError("PACK_EXTRACT", `Refusing path escape for archive entry: ${name}`, {
        path: name,
      });
    }
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, data);
    count += 1;
  }

  return { ok: true, outputDir, filesExtracted: count };
}

/** Aliases for acceptance helpers. */
export const unpackArchive = extractPackArchive;
export const extractPack = extractPackArchive;
