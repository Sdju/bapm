import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadManifest } from "@/modules/Manifest";
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

/**
 * Validate project manifest, collect pack set, refuse secrets, optionally write plain zip.
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

  // Validate dual-read manifest before any durable write.
  let document;
  try {
    ({ document } = loadManifest({ cwd }));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Manifest validation failed for pack";
    throw new PackError("PACK_VALIDATION", message, { cause });
  }

  const entries = collectPackFiles(cwd);
  assertProjectHasContent(entries);

  const dryRun = options.dryRun === true;
  const archive = options.archive !== false;

  if (!archive) {
    // M7 MUST path is --archive; directory pack is optional and not implemented yet.
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
  };
}

/** Alias accepted by acceptance helpers. */
export const packProject = runPack;
export const packArchive = runPack;
