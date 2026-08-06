import { ManifestError } from "./errors.ts";
import { parseManifest } from "./parse.ts";
import type { BapmManifest } from "./types.ts";

export type CreateMinimalManifestOptions = {
  /** Package / project name (required, non-empty). */
  name: string;
  /** Semver-shaped version; defaults to `0.1.0`. */
  version?: string;
  /** Single host target (mutually exclusive with `targets`). */
  target?: string;
  /** Multi host targets (mutually exclusive with `target`). */
  targets?: string[];
  description?: string;
  author?: string;
  /**
   * When true, emit plugin-mode scaffold fields:
   * `devDependencies.apm`, `includes: auto`, `scripts: {}`.
   * Consumer / default path remains unchanged when omitted/false.
   */
  pluginMode?: boolean;
};

/**
 * Build a minimal conforming producer manifest (mf-001..003, mf-021).
 * Never includes top-level `workspaces`.
 */
export function createMinimalManifest(options: CreateMinimalManifestOptions): BapmManifest {
  const name = typeof options.name === "string" ? options.name.trim() : "";
  if (!name) {
    throw new ManifestError("MANIFEST_VALIDATION", 'Manifest requires non-empty "name"', {
      path: "name",
    });
  }

  const version =
    typeof options.version === "string" && options.version.length > 0 ? options.version : "0.1.0";

  const doc: Record<string, unknown> = {
    name,
    version,
    dependencies: {
      apm: [],
      mcp: [],
    },
  };

  if (options.description !== undefined) doc.description = options.description;
  if (options.author !== undefined) doc.author = options.author;

  if (options.pluginMode) {
    doc.devDependencies = { apm: [] };
    doc.includes = "auto";
    doc.scripts = {};
  }

  if (options.target !== undefined && options.targets !== undefined) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      'Manifest must not declare both "target" and "targets"',
      { path: "target" },
    );
  }
  if (options.target !== undefined) doc.target = options.target;
  if (options.targets !== undefined) doc.targets = options.targets;

  return parseManifest(doc);
}

/** Alias accepted by acceptance helpers. */
export const createMinimalManifestDocument = createMinimalManifest;
