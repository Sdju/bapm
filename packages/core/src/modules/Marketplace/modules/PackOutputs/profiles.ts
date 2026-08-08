import { isAbsolute, normalize, relative, resolve, sep } from "node:path";
import type { MarketplaceAuthoringConfig } from "../Authoring/types.ts";
import { MarketplacePackOutputsError } from "./errors.ts";
import type { MarketplaceOutputFormat } from "./types.ts";

/** Ensure candidate resolves under project root (path jail). */
export function ensureMarketplacePathWithin(absolutePath: string, projectRoot: string): string {
  const root = resolve(projectRoot);
  const target = resolve(absolutePath);
  const rel = relative(root, target);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new MarketplacePackOutputsError(
      `Marketplace output path escapes project root (path jail): ${absolutePath}`,
    );
  }
  // Reject weird normalized escapes that slipped through on some platforms
  const norm = normalize(target);
  if (!norm.startsWith(root + sep) && norm !== root) {
    throw new MarketplacePackOutputsError(
      `Marketplace output path escapes project root (path jail): ${absolutePath}`,
    );
  }
  return target;
}

export type ResolveEffectiveOutputPathOptions = {
  cwd: string;
  format: MarketplaceOutputFormat;
  defaultOutput: string;
  /** Explicit override path (CLI or caller). */
  path?: string;
  config?: MarketplaceAuthoringConfig;
};

/**
 * Resolve effective output path with precedence:
 * CLI override → outputs.<fmt>.path → profile default.
 * Confined under project root.
 */
export function resolveEffectiveOutputPath(options: ResolveEffectiveOutputPathOptions): string {
  const cwd = resolve(options.cwd);
  const format = options.format;
  let configured: string | undefined = options.path;
  if (configured === undefined && options.config?.outputs) {
    const entry = options.config.outputs[format];
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const pathVal = (entry as Record<string, unknown>).path;
      if (typeof pathVal === "string" && pathVal.trim()) configured = pathVal.trim();
    }
  }
  if (configured === undefined) configured = options.defaultOutput;

  const absolute = isAbsolute(configured) ? configured : resolve(cwd, configured);
  return ensureMarketplacePathWithin(absolute, cwd);
}

/** Alias for acceptance soft-resolve. */
export const resolveMarketplaceOutputPath = resolveEffectiveOutputPath;

function outputEntryEnabled(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  if (typeof value === "object") return true;
  if (typeof value === "string") return value.length > 0;
  return Boolean(value);
}

/**
 * Formats enabled by authoring `outputs` map (and legacy top-level claude/codex keys).
 */
export function formatsEnabledInConfig(
  config: MarketplaceAuthoringConfig,
  knownFormats: Iterable<string>,
): MarketplaceOutputFormat[] {
  const out: MarketplaceOutputFormat[] = [];
  const outputs = config.outputs ?? {};

  for (const name of knownFormats) {
    if (outputEntryEnabled(outputs[name])) {
      out.push(name);
      continue;
    }
    // Legacy single-format keys on marketplace block
    if (name === "claude" && outputEntryEnabled(config.claude)) out.push(name);
    if (name === "codex" && outputEntryEnabled(config.codex)) out.push(name);
  }
  return out;
}

export type ParseMarketplaceFilterResult =
  | { kind: "all" }
  | { kind: "none" }
  | { kind: "list"; formats: MarketplaceOutputFormat[] };

/**
 * Parse CLI `--marketplace` filter. Unknown format → hard error.
 */
export function parseMarketplaceFilter(
  marketplace: string | string[] | "all" | "none" | undefined,
  knownFormats: ReadonlySet<string> = new Set(),
): ParseMarketplaceFilterResult {
  if (marketplace === undefined || marketplace === "all") return { kind: "all" };
  if (marketplace === "none") return { kind: "none" };

  const rawParts = Array.isArray(marketplace)
    ? marketplace.flatMap((s) => String(s).split(","))
    : String(marketplace).split(",");
  const parts = rawParts.map((s) => s.trim()).filter(Boolean);
  if (parts.length === 1 && parts[0]!.toLowerCase() === "all") return { kind: "all" };
  if (parts.length === 1 && parts[0]!.toLowerCase() === "none") return { kind: "none" };

  const formats: MarketplaceOutputFormat[] = [];
  for (const p of parts) {
    const lower = p.toLowerCase();
    if (!knownFormats.has(lower)) {
      throw new MarketplacePackOutputsError(
        `Unknown marketplace format '${p}' (unknown format). Known: ${[...knownFormats].sort().join(", ")}`,
      );
    }
    formats.push(lower as MarketplaceOutputFormat);
  }
  return { kind: "list", formats };
}

/** Intersect config-enabled formats with CLI filter. */
export function selectOutputFormats(
  config: MarketplaceAuthoringConfig,
  marketplace: string | string[] | "all" | "none" | undefined,
  knownFormats: ReadonlySet<string> = new Set(),
): MarketplaceOutputFormat[] {
  const filter = parseMarketplaceFilter(marketplace, knownFormats);
  if (filter.kind === "none") return [];
  const enabled = formatsEnabledInConfig(config, knownFormats);
  if (filter.kind === "all") return enabled;
  return filter.formats.filter((f) => enabled.includes(f));
}

export function normalizeMarketplacePathOverrides(
  input: Record<string, string> | Array<string | { format: string; path: string }> | undefined,
  knownFormats: ReadonlySet<string> = new Set(),
): Record<string, string> {
  if (!input) return {};
  if (!Array.isArray(input)) return { ...input };

  const out: Record<string, string> = {};
  for (const item of input) {
    if (typeof item === "string") {
      const eq = item.indexOf("=");
      if (eq <= 0) {
        throw new MarketplacePackOutputsError(
          `--marketplace-path must be FORMAT=PATH, got: ${item}`,
        );
      }
      const format = item.slice(0, eq).trim().toLowerCase();
      const path = item.slice(eq + 1).trim();
      if (!knownFormats.has(format)) {
        throw new MarketplacePackOutputsError(
          `Unknown marketplace format '${format}' in --marketplace-path`,
        );
      }
      if (!path) {
        throw new MarketplacePackOutputsError(`Missing path in --marketplace-path ${item}`);
      }
      out[format] = path;
      continue;
    }
    const format = String(item.format).trim().toLowerCase();
    if (!knownFormats.has(format)) {
      throw new MarketplacePackOutputsError(
        `Unknown marketplace format '${format}' in --marketplace-path`,
      );
    }
    out[format] = item.path;
  }
  return out;
}
