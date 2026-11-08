import { readFileSync } from "node:fs";
import { detectAuthoringConfigSource } from "../../authoring.ts";
import { buildMarketplaceOutputs } from "./build.ts";
import { MarketplacePackOutputsError } from "./errors.ts";
import type { BuildMarketplaceOutputsOptions, MarketplaceOutputDocument } from "./types.ts";

export type MarketplaceDriftDifference = {
  /** Dotted/bracket path within the JSON document (`plugins[0].name`). */
  path: string;
  old: unknown;
  new: unknown;
};

export type MarketplaceDriftStatus = "unchanged" | "missing" | "drift";

export type MarketplaceDriftOutput = {
  format: string;
  /** Absolute effective output path. */
  path: string;
  status: MarketplaceDriftStatus;
  differences: MarketplaceDriftDifference[];
};

export type CheckMarketplaceDriftResult = {
  ok: boolean;
  skipped: boolean;
  outputs: MarketplaceDriftOutput[];
};

export type CheckMarketplaceDriftOptions = Omit<BuildMarketplaceOutputsOptions, "dryRun" | "quiet">;

function joinPath(parent: string, key: string): string {
  return parent ? `${parent}.${key}` : key;
}

/** Recursively diff two JSON values (added keys have `old: undefined`). */
export function diffMarketplaceJson(
  oldValue: unknown,
  newValue: unknown,
  prefix = "",
): MarketplaceDriftDifference[] {
  const diffs: MarketplaceDriftDifference[] = [];

  if (isRecord(oldValue) && isRecord(newValue)) {
    const keys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
    for (const key of [...keys].sort()) {
      const child = joinPath(prefix, key);
      if (!(key in oldValue)) {
        diffs.push({ path: child, old: undefined, new: newValue[key] });
      } else if (!(key in newValue)) {
        diffs.push({ path: child, old: oldValue[key], new: undefined });
      } else {
        diffs.push(...diffMarketplaceJson(oldValue[key], newValue[key], child));
      }
    }
    return diffs;
  }

  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    const max = Math.max(oldValue.length, newValue.length);
    for (let i = 0; i < max; i++) {
      const child = `${prefix}[${i}]`;
      if (i >= oldValue.length) {
        diffs.push({ path: child, old: undefined, new: newValue[i] });
      } else if (i >= newValue.length) {
        diffs.push({ path: child, old: oldValue[i], new: undefined });
      } else {
        diffs.push(...diffMarketplaceJson(oldValue[i], newValue[i], child));
      }
    }
    return diffs;
  }

  if (oldValue !== newValue) {
    diffs.push({ path: prefix, old: oldValue, new: newValue });
  }
  return diffs;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readOnDisk(path: string): { exists: boolean; value: unknown; parseable: boolean } {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { exists: false, value: undefined, parseable: false };
    throw new MarketplacePackOutputsError(
      `Failed to read marketplace output for drift check: ${path} (${code ?? String(err)})`,
      1,
    );
  }
  try {
    return { exists: true, value: JSON.parse(raw), parseable: true };
  } catch {
    return { exists: true, value: undefined, parseable: false };
  }
}

function compareDocument(doc: MarketplaceOutputDocument): MarketplaceDriftOutput {
  const onDisk = readOnDisk(doc.path);
  if (!onDisk.exists) {
    return {
      format: doc.format,
      path: doc.path,
      status: "missing",
      differences: [{ path: "", old: undefined, new: JSON.parse(doc.body) }],
    };
  }
  if (!onDisk.parseable) {
    return {
      format: doc.format,
      path: doc.path,
      status: "drift",
      differences: [{ path: "", old: undefined, new: JSON.parse(doc.body) }],
    };
  }

  const differences = diffMarketplaceJson(onDisk.value, JSON.parse(doc.body));
  return {
    format: doc.format,
    path: doc.path,
    status: differences.length === 0 ? "unchanged" : "drift",
    differences,
  };
}

/**
 * APM `pack --check-clean` semantics: regenerate every selected marketplace
 * output in memory and compare it semantically with the file on disk.
 * Writes nothing; returns `skipped` when the project has no marketplace block.
 */
export async function checkMarketplaceDrift(
  options: CheckMarketplaceDriftOptions = {},
): Promise<CheckMarketplaceDriftResult> {
  const detected = detectAuthoringConfigSource({ cwd: options.cwd });
  if (!detected.ok) {
    if (detected.kind === "both") {
      throw new MarketplacePackOutputsError(detected.error);
    }
    return { ok: true, skipped: true, outputs: [] };
  }

  const built = await buildMarketplaceOutputs({
    ...options,
    dryRun: true,
    quiet: true,
  });
  if (built.skipped) return { ok: true, skipped: true, outputs: [] };

  const outputs = built.documents
    .map(compareDocument)
    .sort((a, b) => a.format.localeCompare(b.format));
  return {
    ok: outputs.every((output) => output.status === "unchanged"),
    skipped: false,
    outputs,
  };
}
