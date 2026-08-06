import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { MarketplaceNotFoundError } from "./errors.ts";
import { MarketplaceSource } from "./models.ts";
import { ensureBapmConfigDir, marketplacesJsonPath } from "./paths.ts";
import type { MarketplaceConfigOptions } from "./types.ts";

type RegistryFile = { marketplaces: Record<string, unknown>[] };

function ensureFile(opts?: MarketplaceConfigOptions): string {
  ensureBapmConfigDir(opts);
  const path = marketplacesJsonPath(opts);
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify({ marketplaces: [] }, null, 2)}\n`, "utf8");
  }
  return path;
}

function load(opts?: MarketplaceConfigOptions): MarketplaceSource[] {
  const path = ensureFile(opts);
  let data: RegistryFile;
  try {
    data = JSON.parse(readFileSync(path, "utf8")) as RegistryFile;
  } catch {
    data = { marketplaces: [] };
  }
  const sources: MarketplaceSource[] = [];
  for (const entry of data.marketplaces ?? []) {
    if (!entry || typeof entry !== "object") continue;
    try {
      sources.push(MarketplaceSource.fromDict(entry));
    } catch {
      // skip invalid
    }
  }
  return sources;
}

function save(sources: MarketplaceSource[], opts?: MarketplaceConfigOptions): void {
  const path = ensureFile(opts);
  const data: RegistryFile = {
    marketplaces: sources.map((s) => s.toDict()),
  };
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

export function listMarketplaces(opts?: MarketplaceConfigOptions): MarketplaceSource[] {
  return load(opts);
}

export function getMarketplace(name: string, opts?: MarketplaceConfigOptions): MarketplaceSource {
  const lower = name.toLowerCase();
  for (const src of load(opts)) {
    if (src.name.toLowerCase() === lower) return src;
  }
  throw new MarketplaceNotFoundError(name);
}

export function addMarketplace(
  source: MarketplaceSource | Record<string, unknown>,
  opts?: MarketplaceConfigOptions,
): MarketplaceSource {
  const src =
    source instanceof MarketplaceSource
      ? source
      : MarketplaceSource.fromDict(source as Record<string, unknown>);
  const sources = load(opts).filter((s) => s.name.toLowerCase() !== src.name.toLowerCase());
  sources.push(src);
  save(sources, opts);
  return src;
}

export function removeMarketplace(name: string, opts?: MarketplaceConfigOptions): void {
  const before = load(opts);
  const after = before.filter((s) => s.name.toLowerCase() !== name.toLowerCase());
  if (after.length === before.length) {
    throw new MarketplaceNotFoundError(name);
  }
  save(after, opts);
}
