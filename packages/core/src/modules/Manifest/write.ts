import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { stringify } from "yaml";
import { activeEntriesToEmitShape } from "./active.ts";
import { discoverManifestPath } from "./discover.ts";
import type { ManifestWarning } from "./errors.ts";
import { parseManifestDocument } from "./parse.ts";
import type { ActiveEntry, BapmManifest } from "./types.ts";

export type WriteManifestOptions = {
  cwd?: string;
  /** Explicit destination path (overrides write-back / discovery). */
  path?: string;
  /** Loaded filename for same-brand write-back. */
  sourceFilename?: string;
  /** Absolute path that was loaded; preferred write-back target. */
  sourcePath?: string;
};

export type WriteProducerManifestOptions = WriteManifestOptions & {
  /** Optional sink for non-blocking warnings (e.g. mf-004). */
  onWarning?: (warning: ManifestWarning) => void;
};

export type WriteProducerManifestResult = {
  path: string;
  warnings: ManifestWarning[];
};

function prepareForSerialize(
  document: BapmManifest | Record<string, unknown>,
): Record<string, unknown> {
  const copy = { ...(document as Record<string, unknown>) };
  const active = copy.active;
  if (Array.isArray(active) && active.length > 0) {
    const entries = active as ActiveEntry[];
    if (
      entries.every(
        (e) =>
          e &&
          typeof e === "object" &&
          (e.kind === "preset" || e.kind === "target") &&
          typeof e.id === "string",
      )
    ) {
      copy.active = activeEntriesToEmitShape(entries);
    }
  }
  const presets = copy.presets;
  if (Array.isArray(presets)) {
    copy.presets = presets.map((p) => {
      if (!p || typeof p !== "object") return p;
      const preset = { ...(p as Record<string, unknown>) };
      const nested = preset.active;
      if (Array.isArray(nested) && nested.length > 0) {
        const entries = nested as ActiveEntry[];
        if (
          entries.every(
            (e) =>
              e &&
              typeof e === "object" &&
              (e.kind === "preset" || e.kind === "target") &&
              typeof e.id === "string",
          )
        ) {
          preset.active = activeEntriesToEmitShape(entries);
        }
      }
      return preset;
    });
  }
  return copy;
}

/**
 * Serialize a manifest document to YAML (round-trip best-effort).
 * Normalized `active` / nested preset `active` emit as list-of-maps.
 */
export function serializeManifest(document: BapmManifest | Record<string, unknown>): string {
  return stringify(prepareForSerialize(document), {
    lineWidth: 0,
    defaultStringType: "PLAIN",
    defaultKeyType: "PLAIN",
  });
}

/**
 * Write manifest YAML back to the discovered dual-read path (or explicit path).
 * Does not validate — prefer {@link writeProducerManifest} for producer emit.
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

/**
 * Producer write path: parse/validate before durable emit (mf-*).
 * Preserves vendor `x-*` keys; mf-004 non-semver is a non-blocking warning.
 */
export function writeProducerManifest(
  document: BapmManifest | Record<string, unknown>,
  options: WriteProducerManifestOptions = {},
): WriteProducerManifestResult {
  const { document: validated, warnings } = parseManifestDocument(document);
  for (const warning of warnings) {
    options.onWarning?.(warning);
  }
  const path = writeManifest(validated, options);
  return { path, warnings };
}

/** Aliases for acceptance / design naming flexibility. */
export const emitManifest = writeProducerManifest;
export const writeManifestValidated = writeProducerManifest;
