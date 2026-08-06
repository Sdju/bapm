import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import type { MarketplaceSource } from "./models.ts";
import { ensureBapmConfigDir, marketplaceCacheDir } from "./paths.ts";
import type { MarketplaceConfigOptions } from "./types.ts";

export const CACHE_TTL_SECONDS = 3600;

export function sanitizeCacheName(name: string): string {
  let safe = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  safe = safe.replace(/^[._]+|[._]+$/g, "") || "unnamed";
  if (safe.includes("..") || safe === "." || safe === "") safe = "unnamed";
  return safe;
}

export function cacheKeyForSource(source: MarketplaceSource): string {
  const kind = source.kind;
  if (kind === "url") {
    const digest = createHash("sha256").update(source.url).digest("hex").slice(0, 16);
    return `url__${digest}`;
  }
  if (kind === "local") {
    return `local__${sanitizeCacheName(source.name)}`;
  }
  if (kind === "git" || kind === "ado") {
    const host = source.host || "unknown";
    return `${kind}__${sanitizeCacheName(host)}__${sanitizeCacheName(source.name)}`;
  }
  const normalizedHost = (source.host || "github.com").toLowerCase();
  if (normalizedHost === "github.com") return sanitizeCacheName(source.name);
  return `${sanitizeCacheName(normalizedHost)}__${sanitizeCacheName(source.name)}`;
}

function ensureCacheDir(opts?: MarketplaceConfigOptions): string {
  ensureBapmConfigDir(opts);
  const dir = marketplaceCacheDir(opts);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function dataPath(key: string, opts?: MarketplaceConfigOptions): string {
  return join(ensureCacheDir(opts), `${sanitizeCacheName(key)}.json`);
}

function metaPath(key: string, opts?: MarketplaceConfigOptions): string {
  return join(ensureCacheDir(opts), `${sanitizeCacheName(key)}.meta.json`);
}

export function readMarketplaceCache(
  key: string,
  opts?: MarketplaceConfigOptions,
): Record<string, unknown> | null {
  const dPath = dataPath(key, opts);
  const mPath = metaPath(key, opts);
  if (!existsSync(dPath) || !existsSync(mPath)) return null;
  try {
    const meta = JSON.parse(readFileSync(mPath, "utf8")) as {
      fetched_at?: number;
      ttl_seconds?: number;
    };
    const fetchedAt = Number(meta.fetched_at ?? 0);
    const ttl = Number(meta.ttl_seconds ?? CACHE_TTL_SECONDS);
    if (!fetchedAt || Date.now() / 1000 - fetchedAt > ttl) return null;
    const data = JSON.parse(readFileSync(dPath, "utf8")) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    return data as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function writeMarketplaceCache(
  key: string,
  data: Record<string, unknown>,
  opts?: MarketplaceConfigOptions & { indexDigest?: string; etag?: string; lastModified?: string },
): void {
  const dPath = dataPath(key, opts);
  const mPath = metaPath(key, opts);
  writeFileSync(dPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  writeFileSync(
    mPath,
    `${JSON.stringify(
      {
        fetched_at: Math.floor(Date.now() / 1000),
        ttl_seconds: CACHE_TTL_SECONDS,
        index_digest: opts?.indexDigest ?? "",
        etag: opts?.etag ?? "",
        last_modified: opts?.lastModified ?? "",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

export function clearMarketplaceCache(
  source: MarketplaceSource | { name: string },
  opts?: MarketplaceConfigOptions,
): number {
  const key =
    source instanceof Object && "kind" in source
      ? cacheKeyForSource(source as MarketplaceSource)
      : sanitizeCacheName(String((source as { name: string }).name));
  const dir = marketplaceCacheDir(opts);
  if (!existsSync(dir)) return 0;
  const safe = sanitizeCacheName(key);
  let cleared = 0;
  for (const name of readdirSync(dir)) {
    if (name === `${safe}.json` || name === `${safe}.meta.json`) {
      unlinkSync(join(dir, name));
      cleared += 1;
    }
  }
  return cleared > 0 ? 1 : 0;
}
