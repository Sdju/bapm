/**
 * Helpers for Marketplace consumer-registry suite (core).
 * Soft-resolve public @bapm/core Marketplace APIs.
 */
import * as core from "@bapm/core";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const suiteDir = dirname(fileURLToPath(import.meta.url));
export const coreRoot = resolve(suiteDir, "../..");
export const srcRoot = join(coreRoot, "src");

type AnyFn = (...args: never[]) => unknown;

export function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @bapm/core to export one of [${names.join(", ")}] (${label})`);
}

export type TempConfig = { configDir: string; cleanup: () => void };

export function createTempConfigDir(prefix = "bapm-mp-accept-"): TempConfig {
  const configDir = mkdtempSync(join(tmpdir(), prefix));
  return {
    configDir,
    cleanup: () => rmSync(configDir, { recursive: true, force: true }),
  };
}

export function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

/** Minimal Claude-style marketplace.json (unique names). */
export const FIXTURE_CLAUDE_OK = `{
  "name": "demo-mp",
  "owner": { "name": "demo" },
  "plugins": [
    {
      "name": "hello-skill",
      "description": "Hello",
      "source": "./plugins/hello",
      "version": "1.0.0"
    },
    {
      "name": "world-agent",
      "description": "World",
      "source": { "source": "local", "path": "./plugins/world" }
    }
  ]
}
`;

/** Copilot-style repository entry. */
export const FIXTURE_COPILOT = `{
  "name": "copilot-mp",
  "plugins": [
    {
      "name": "tools",
      "description": "Tools",
      "repository": "acme/tools",
      "ref": "main"
    }
  ]
}
`;

/** Includes an npm source that MUST be skipped. */
export const FIXTURE_WITH_NPM = `{
  "name": "mixed-mp",
  "plugins": [
    {
      "name": "keep-me",
      "source": "./keep"
    },
    {
      "name": "npm-skip",
      "source": { "source": "npm", "package": "@acme/pkg" }
    }
  ]
}
`;

/** Duplicate plugin names (case-insensitive). */
export const FIXTURE_DUP_NAMES = `{
  "name": "dup-mp",
  "plugins": [
    { "name": "Foo", "source": "./a" },
    { "name": "foo", "source": "./b" }
  ]
}
`;

/** Malformed registry field (non-string). */
export const FIXTURE_BAD_REGISTRY = `{
  "name": "bad-reg",
  "plugins": [
    {
      "name": "broken",
      "source": "./x",
      "registry": 42
    }
  ]
}
`;

export function writeLocalMarketplaceDir(
  root: string,
  relativePath: string,
  body: string = FIXTURE_CLAUDE_OK,
): string {
  const file = join(root, relativePath);
  writeText(file, body);
  return file;
}

export function listFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function getParseMarketplaceJson() {
  return pickExport(
    ["parseMarketplaceJson", "parse_marketplace_json"],
    "marketplace parse",
  ) as (input: string | unknown) => unknown;
}

export function getCreateMarketplaceSource(): (...args: unknown[]) => Record<string, unknown> {
  const Ctor = pickExport(
    ["createMarketplaceSource", "MarketplaceSource"],
    "MarketplaceSource factory",
  );
  return (...args: unknown[]) => {
    try {
      return Reflect.construct(Ctor, args) as Record<string, unknown>;
    } catch {
      return Ctor(...(args as never[])) as Record<string, unknown>;
    }
  };
}

export function getUrlNamesRemoteManifest() {
  return pickExport(
    ["urlNamesRemoteManifest", "url_names_remote_manifest", "isRemoteMarketplaceManifestUrl"],
    "urlNamesRemoteManifest",
  ) as (url: string) => boolean;
}

export function getPathHelpers() {
  return {
    getBapmConfigDir: pickExport(
      ["getBapmConfigDir", "bapmConfigDir", "marketplaceConfigDir"],
      "getBapmConfigDir",
    ) as (opts?: { configDir?: string }) => string,
    marketplacesJsonPath: pickExport(
      ["marketplacesJsonPath", "getMarketplacesJsonPath"],
      "marketplacesJsonPath",
    ) as (opts?: { configDir?: string }) => string,
    marketplaceCacheDir: pickExport(
      ["marketplaceCacheDir", "getMarketplaceCacheDir"],
      "marketplaceCacheDir",
    ) as (opts?: { configDir?: string }) => string,
    ensureBapmConfigDir: pickExport(
      ["ensureBapmConfigDir", "ensureMarketplaceConfigDir"],
      "ensureBapmConfigDir",
    ) as (opts?: { configDir?: string }) => string,
  };
}

export function getRegistryApi() {
  return {
    list: pickExport(
      ["listMarketplaces", "getRegisteredMarketplaces", "listRegisteredMarketplaces"],
      "list marketplaces",
    ) as (opts?: { configDir?: string }) => unknown[],
    get: pickExport(
      ["getMarketplace", "getRegisteredMarketplace"],
      "get marketplace",
    ) as (name: string, opts?: { configDir?: string }) => unknown,
    add: pickExport(
      ["addMarketplace", "registerMarketplace"],
      "add marketplace",
    ) as (source: unknown, opts?: { configDir?: string }) => unknown,
    remove: pickExport(
      ["removeMarketplace", "unregisterMarketplace"],
      "remove marketplace",
    ) as (name: string, opts?: { configDir?: string }) => unknown,
  };
}

export function getFetchApi() {
  return {
    fetch: pickExport(
      ["fetchMarketplace", "fetch_marketplace"],
      "fetchMarketplace",
    ) as (source: unknown, opts?: Record<string, unknown>) => Promise<unknown> | unknown,
    clearCache: pickExport(
      ["clearMarketplaceCache", "clear_marketplace_cache"],
      "clearMarketplaceCache",
    ) as (source: unknown, opts?: Record<string, unknown>) => unknown,
  };
}

export function getValidateMarketplace() {
  return pickExport(
    ["validateMarketplace", "validate_marketplace"],
    "validateMarketplace",
  ) as (manifest: unknown) => unknown;
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  throw new TypeError(`expected object, got ${typeof value}`);
}

export function pluginNames(manifest: unknown): string[] {
  const m = asRecord(manifest);
  const plugins = m.plugins;
  if (!Array.isArray(plugins)) return [];
  return plugins.map((p) => String(asRecord(p).name ?? ""));
}

export function sourceKind(source: unknown): string {
  const s = asRecord(source);
  const kind = s.kind;
  if (typeof kind === "string") return kind;
  if (typeof kind === "function") return String((kind as () => string).call(source));
  // Some implementations expose getter via prototype — try property access again after unwrap
  const proto = Object.getPrototypeOf(source) as { kind?: unknown } | null;
  if (proto && typeof proto.kind === "function") {
    return String((proto.kind as () => string).call(source));
  }
  throw new TypeError("MarketplaceSource.kind missing");
}

export function findPluginByName(manifest: unknown, name: string): unknown {
  const m = asRecord(manifest);
  const find =
    typeof m.findPlugin === "function"
      ? (m.findPlugin as (n: string) => unknown)
      : typeof m.getPlugin === "function"
        ? (m.getPlugin as (n: string) => unknown)
        : null;
  if (find) return find.call(manifest, name);
  const plugins = Array.isArray(m.plugins) ? m.plugins : [];
  const hit = plugins.find(
    (p) => String(asRecord(p).name ?? "").toLowerCase() === name.toLowerCase(),
  );
  if (!hit) throw new TypeError(`plugin ${name} not found and no findPlugin helper`);
  return hit;
}

export function validationFailed(results: unknown): boolean {
  if (Array.isArray(results)) {
    return results.some((r) => {
      const row = asRecord(r);
      return row.passed === false || (Array.isArray(row.errors) && row.errors.length > 0);
    });
  }
  const row = asRecord(results);
  if (typeof row.ok === "boolean") return !row.ok;
  if (typeof row.passed === "boolean") return !row.passed;
  if (Array.isArray(row.errors) && row.errors.length > 0) return true;
  if (Array.isArray(row.results)) return validationFailed(row.results);
  throw new TypeError("unrecognized validateMarketplace result shape");
}

export function validationMentionsDuplicate(results: unknown): boolean {
  const text = JSON.stringify(results);
  return /duplicate/i.test(text);
}
