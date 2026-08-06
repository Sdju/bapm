import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadYamlDocument } from "@/common/yaml/loadDocument.ts";
import { MarketplaceAuthoringError } from "./errors.ts";
import {
  loadMarketplaceFromBapmYml,
  loadMarketplaceFromLegacyYml,
} from "./load.ts";
import type {
  DetectAuthoringConfigSourceOptions,
  DetectAuthoringConfigSourceResult,
  LoadMarketplaceResult,
} from "./types.ts";

const DEPRECATION_MESSAGE =
  "marketplace.yml is deprecated. Run 'bapm marketplace migrate' to " +
  "fold it into bapm.yml's 'marketplace:' block.";

function hasMarketplaceBlock(bapmYmlPath: string): boolean {
  if (!existsSync(bapmYmlPath)) return false;
  let text: string;
  try {
    text = readFileSync(bapmYmlPath, "utf8");
  } catch (err) {
    throw new MarketplaceAuthoringError(
      `Could not read bapm.yml: ${err instanceof Error ? err.message : String(err)}`,
      1,
    );
  }
  let data: unknown;
  try {
    data = loadYamlDocument(text, bapmYmlPath);
  } catch (err) {
    throw new MarketplaceAuthoringError(
      err instanceof Error ? err.message : String(err),
      2,
    );
  }
  if (!data || typeof data !== "object") return false;
  const marketplace = (data as Record<string, unknown>).marketplace;
  return marketplace !== undefined && marketplace !== null;
}

/**
 * Detect authoring config source: preferred bapm.yml block / legacy / both / none.
 */
export function detectAuthoringConfigSource(
  options: DetectAuthoringConfigSourceOptions = {},
): DetectAuthoringConfigSourceResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  const bapmPath = resolve(cwd, "bapm.yml");
  const legacyPath = resolve(cwd, "marketplace.yml");

  const hasBlock = hasMarketplaceBlock(bapmPath);
  const hasLegacy = existsSync(legacyPath);

  if (hasBlock && hasLegacy) {
    const error =
      "Both bapm.yml (with a 'marketplace:' block) and marketplace.yml exist " +
      "(conflict / ambiguous). Remove marketplace.yml or run " +
      "'bapm marketplace migrate --force' to consolidate.";
    return { kind: "both", ok: false, error };
  }
  if (hasBlock) {
    return { kind: "bapm.yml", ok: true, path: bapmPath };
  }
  if (hasLegacy) {
    return { kind: "marketplace.yml", ok: true, path: legacyPath };
  }
  const message =
    "No marketplace config found (none / missing / absent). " +
    "Add a 'marketplace:' block to bapm.yml or run 'bapm marketplace init' to scaffold one.";
  return { kind: "none", ok: false, message, error: message };
}

/**
 * Smart loader: detect source, load, warn if legacy.
 * Throws MarketplaceAuthoringError on both/none/validation.
 */
export function loadMarketplaceAuthoringConfig(
  options: {
    cwd?: string;
    warn?: (message: string) => void;
  } = {},
): LoadMarketplaceResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  const detected = detectAuthoringConfigSource({ cwd });
  if (detected.kind === "both") {
    throw new MarketplaceAuthoringError(detected.error, 2);
  }
  if (detected.kind === "none") {
    throw new MarketplaceAuthoringError(detected.message, 1);
  }
  if (detected.kind === "bapm.yml") {
    return loadMarketplaceFromBapmYml({ cwd, path: detected.path });
  }
  options.warn?.(DEPRECATION_MESSAGE);
  return loadMarketplaceFromLegacyYml({ cwd, path: detected.path });
}

export { DEPRECATION_MESSAGE };
