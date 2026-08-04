/**
 * Thin zip adapters over `fflate` (catalog dep). Keep library details here only.
 */
import { unzipSync, zipSync } from "fflate";
import { PackError } from "./errors.ts";

export function createZipArchive(files: Record<string, Uint8Array>): Uint8Array {
  try {
    return zipSync(files, { level: 6 });
  } catch (cause) {
    throw new PackError("PACK_IO", "Failed to create zip archive", { cause });
  }
}

export function readZipArchive(bytes: Uint8Array): Record<string, Uint8Array> {
  try {
    return unzipSync(bytes);
  } catch (cause) {
    throw new PackError("PACK_EXTRACT", "Failed to extract zip archive (corrupt or not a zip)", {
      cause,
    });
  }
}
