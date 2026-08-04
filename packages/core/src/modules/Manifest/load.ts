import { readFileSync } from "node:fs";
import { discoverManifestPath } from "./discover.ts";
import { ManifestError } from "./errors.ts";
import { parseManifestDocument } from "./parse.ts";
import type { LoadManifestOptions, LoadManifestResult } from "./types.ts";
import { loadYamlDocument } from "./yaml-load.ts";

/**
 * Discover → read file → safe YAML → validate.
 * Does not resolve, lock, download, or install.
 */
export function loadManifest(options: LoadManifestOptions = {}): LoadManifestResult {
  const discovered = discoverManifestPath(options);

  let text: string;
  try {
    text = readFileSync(discovered.path, "utf8");
  } catch (cause) {
    throw new ManifestError(
      "MANIFEST_MISSING_FILE",
      `Manifest file not found: ${discovered.path}`,
      { path: discovered.path, cause },
    );
  }

  const raw = loadYamlDocument(text, discovered.path);
  const { document, warnings } = parseManifestDocument(raw);

  return {
    document,
    sourcePath: discovered.path,
    sourceFilename: discovered.filename,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
