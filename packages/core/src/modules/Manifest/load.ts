import { readFileSync } from "node:fs";
import { discoverManifestPath } from "./discover.ts";
import { ManifestError } from "./errors.ts";
import {
  assertNoApmLocalOverlay,
  loadLocalOverlayIfPresent,
  mergeLocalOverlay,
  overlayRootForBase,
} from "./localOverlay.ts";
import { parseManifestDocument } from "./parse.ts";
import type { LoadManifestOptions, LoadManifestResult } from "./types.ts";
import { loadYamlDocument } from "./yaml-load.ts";

/**
 * Discover → read base dual-read file → safe YAML → validate.
 * Does **not** merge `bapm.local.yml` (use `loadEffectiveManifest` / `loadManifest` for that).
 * Suitable for publish/pack wire identity serialization.
 */
export function loadBaseManifest(options: LoadManifestOptions = {}): LoadManifestResult {
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

/**
 * Load validated base dual-read manifest, then optionally merge `bapm.local.yml`.
 * Precedence for settings: CLI flags (call-site) → local overlay → base → env overrides.
 */
export function loadEffectiveManifest(options: LoadManifestOptions = {}): LoadManifestResult {
  const base = loadBaseManifest(options);
  const projectRoot = overlayRootForBase(base.sourcePath);

  assertNoApmLocalOverlay(projectRoot);

  const local = loadLocalOverlayIfPresent(projectRoot);
  if (!local) {
    return base;
  }

  const document = mergeLocalOverlay(base.document, local.fields);
  return {
    document,
    sourcePath: base.sourcePath,
    sourceFilename: base.sourceFilename,
    localPath: local.localPath,
    ...(base.warnings !== undefined ? { warnings: base.warnings } : {}),
  };
}

/**
 * Discover → read file → safe YAML → validate → merge optional personal overlay.
 * Does not resolve, lock, download, or install.
 */
export function loadManifest(options: LoadManifestOptions = {}): LoadManifestResult {
  return loadEffectiveManifest(options);
}
