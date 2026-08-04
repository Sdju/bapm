import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { stringify } from "yaml";
import { discoverManifestPath } from "./discover.ts";
import type { BapmManifest } from "./types.ts";

export type WriteManifestOptions = {
  cwd?: string;
  /** Explicit destination path (overrides write-back / discovery). */
  path?: string;
  /** Loaded filename for same-brand write-back. */
  sourceFilename?: string;
  /** Absolute path that was loaded; preferred write-back target. */
  sourcePath?: string;
};

/**
 * Serialize a manifest document to YAML (round-trip best-effort).
 */
export function serializeManifest(document: BapmManifest | Record<string, unknown>): string {
  return stringify(document, {
    lineWidth: 0,
    defaultStringType: "PLAIN",
    defaultKeyType: "PLAIN",
  });
}

/**
 * Write manifest YAML back to the discovered dual-read path (or explicit path).
 */
export function writeManifest(
  document: BapmManifest | Record<string, unknown>,
  options: WriteManifestOptions = {},
): string {
  const cwd = resolve(options.cwd ?? process.cwd());
  let dest = options.path ?? options.sourcePath;
  if (!dest) {
    if (options.sourceFilename) {
      dest = resolve(cwd, options.sourceFilename);
    } else {
      const discovered = discoverManifestPath({ cwd });
      dest = discovered.path;
    }
  }
  writeFileSync(dest, serializeManifest(document), "utf8");
  return dest;
}
