import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createMarketplaceOutputRegistry,
  type MarketplaceOutputIntegration,
  type MarketplaceOutputRegistry,
} from "@bapm/integration-api";
import { loadMarketplaceAuthoringConfig } from "@bapm/core";

/** Known marketplace format ids that follow `@bapm/integration-<id>` packages. */
const KNOWN_MARKETPLACE_FORMATS = ["claude", "codex"] as const;

type KnownFormat = (typeof KNOWN_MARKETPLACE_FORMATS)[number];

/** Empty marketplace-output registry — packages load on demand for pack. */
export function createCliMarketplaceOutputRegistry(): MarketplaceOutputRegistry {
  return createMarketplaceOutputRegistry();
}

function packageSpecifierForFormat(format: string): string {
  return `@bapm/integration-${format}`;
}

function isKnownFormat(format: string): format is KnownFormat {
  return (KNOWN_MARKETPLACE_FORMATS as readonly string[]).includes(format);
}

function outputEntryEnabled(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  if (typeof value === "object") return true;
  if (typeof value === "string") return value.length > 0;
  return Boolean(value);
}

function formatsEnabledInAuthoring(config: {
  outputs?: Record<string, unknown>;
  claude?: unknown;
  codex?: unknown;
}): string[] {
  const out: string[] = [];
  const outputs = config.outputs ?? {};
  for (const format of KNOWN_MARKETPLACE_FORMATS) {
    if (outputEntryEnabled(outputs[format])) {
      out.push(format);
      continue;
    }
    if (format === "claude" && outputEntryEnabled(config.claude)) out.push(format);
    if (format === "codex" && outputEntryEnabled(config.codex)) out.push(format);
  }
  return out;
}

function parseFilterFormats(marketplace: string | string[] | "all" | "none" | undefined): {
  kind: "all" | "none" | "list";
  formats: string[];
} {
  if (marketplace === undefined || marketplace === "all") return { kind: "all", formats: [] };
  if (marketplace === "none") return { kind: "none", formats: [] };

  const rawParts = Array.isArray(marketplace)
    ? marketplace.flatMap((s) => String(s).split(","))
    : String(marketplace).split(",");
  const parts = rawParts.map((s) => s.trim()).filter(Boolean);
  if (parts.length === 1 && parts[0]!.toLowerCase() === "all") {
    return { kind: "all", formats: [] };
  }
  if (parts.length === 1 && parts[0]!.toLowerCase() === "none") {
    return { kind: "none", formats: [] };
  }
  return { kind: "list", formats: parts.map((p) => p.toLowerCase()) };
}

function resolveNpmPackage(specifier: string, cwd: string): string {
  const requireFromCwd = createRequire(join(cwd, "package.json"));
  try {
    return requireFromCwd.resolve(specifier);
  } catch (cwdErr) {
    const requireFromCli = createRequire(import.meta.url);
    try {
      return requireFromCli.resolve(specifier);
    } catch {
      throw cwdErr;
    }
  }
}

function extractMarketplaceIntegration(
  mod: Record<string, unknown>,
  format: string,
): MarketplaceOutputIntegration | undefined {
  const preferredKeys = [
    `${format}MarketplaceIntegration`,
    "marketplaceOutputIntegration",
    "default",
  ];
  for (const key of preferredKeys) {
    const value = mod[key];
    if (value && typeof value === "object") {
      const rec = value as Record<string, unknown>;
      const mo = rec.marketplaceOutput;
      if (mo && typeof mo === "object") {
        return value as MarketplaceOutputIntegration;
      }
    }
  }
  for (const value of Object.values(mod)) {
    if (!value || typeof value !== "object") continue;
    const rec = value as Record<string, unknown>;
    const mo = rec.marketplaceOutput;
    if (mo && typeof mo === "object") {
      const fmt = (mo as { format?: unknown }).format;
      if (typeof fmt === "string" && fmt.toLowerCase() === format) {
        return value as MarketplaceOutputIntegration;
      }
    }
  }
  return undefined;
}

async function loadMarketplacePackage(
  format: string,
  cwd: string,
): Promise<MarketplaceOutputIntegration> {
  const specifier = packageSpecifierForFormat(format);
  let resolved: string;
  try {
    resolved = resolveNpmPackage(specifier, cwd);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new Error(
      `Cannot resolve marketplace format '${format}': install ${specifier} ` +
        `(e.g. npm i -D ${specifier}). ${detail}`,
    );
  }

  let mod: Record<string, unknown>;
  try {
    const imported = await import(pathToFileURL(resolved).href);
    mod = (imported ?? {}) as Record<string, unknown>;
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new Error(
      `Failed to load marketplace integration ${specifier} for format '${format}': ${detail}`,
    );
  }

  const integration = extractMarketplaceIntegration(mod, format);
  if (!integration) {
    throw new Error(
      `Package ${specifier} does not export marketplace-output capability for format '${format}'. ` +
        `Install a valid host integration (e.g. npm i -D ${specifier}).`,
    );
  }
  return integration;
}

/**
 * Resolve formats needed for this pack run, dynamically load corresponding
 * `@bapm/integration-<format>` packages, and return a populated registry.
 * Fail closed with install guidance when a needed package is missing.
 */
export async function loadCliMarketplaceOutputsForPack(options: {
  cwd?: string;
  marketplace?: string | string[] | "all" | "none";
}): Promise<MarketplaceOutputRegistry> {
  const cwd = options.cwd ?? process.cwd();
  const registry = createCliMarketplaceOutputRegistry();
  const filter = parseFilterFormats(options.marketplace);

  if (filter.kind === "none") return registry;

  if (filter.kind === "list") {
    for (const format of filter.formats) {
      if (!isKnownFormat(format)) {
        throw new Error(
          `Unknown marketplace format '${format}' (unknown format). ` +
            `Known: ${KNOWN_MARKETPLACE_FORMATS.join(", ")}`,
        );
      }
    }
  }

  let enabledInConfig: string[] = [];
  try {
    const { config } = loadMarketplaceAuthoringConfig({ cwd });
    enabledInConfig = formatsEnabledInAuthoring(
      config as {
        outputs?: Record<string, unknown>;
        claude?: unknown;
        codex?: unknown;
      },
    );
  } catch {
    // No marketplace authoring — only explicit filter lists force a load attempt.
    enabledInConfig = [];
  }

  const formatsToLoad = new Set<string>();
  if (filter.kind === "list") {
    for (const format of filter.formats) {
      // Explicit CLI selection requires the package even if config later skips emit.
      formatsToLoad.add(format);
    }
  } else {
    for (const format of enabledInConfig) formatsToLoad.add(format);
  }

  for (const format of formatsToLoad) {
    if (!isKnownFormat(format)) continue;
    const integration = await loadMarketplacePackage(format, cwd);
    registry.register(integration);
  }

  return registry;
}
