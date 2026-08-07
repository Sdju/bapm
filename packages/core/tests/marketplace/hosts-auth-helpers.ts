/**
 * Helpers for marketplace hosts-auth suite (promoted from mp-hosts-auth).
 * Soft-resolve thin host-classify / token APIs from @bapm/core.
 */
import * as core from "@bapm/core";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const suiteDir = dirname(fileURLToPath(import.meta.url));

type AnyFn = (...args: never[]) => unknown;

export function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @bapm/core to export one of [${names.join(", ")}] (${label})`);
}

export function getCreateMarketplaceSource(): (init: Record<string, unknown>) => {
  kind: string;
  name: string;
  url: string;
  host?: string;
  owner?: string;
  repo?: string;
} {
  return pickExport(["createMarketplaceSource"], "create marketplace source") as (
    init: Record<string, unknown>,
  ) => {
    kind: string;
    name: string;
    url: string;
    host?: string;
    owner?: string;
    repo?: string;
  };
}

export function getFetchMarketplace(): (
  source: unknown,
  opts?: Record<string, unknown>,
) => Promise<unknown> {
  return pickExport(["fetchMarketplace"], "fetch marketplace manifest") as (
    source: unknown,
    opts?: Record<string, unknown>,
  ) => Promise<unknown>;
}

/** Fine-grained marketplace host class (github / ghe_cloud / ghes / gitlab / ado / …). */
export function getClassifyMarketplaceHost(): (host: string, env?: NodeJS.ProcessEnv) => string {
  return pickExport(
    [
      "classifyMarketplaceHost",
      "classifyMarketplaceHostClass",
      "marketplaceHostClassOf",
      "hostClassForMarketplace",
    ],
    "marketplace host classification",
  ) as (host: string, env?: NodeJS.ProcessEnv) => string;
}

/** Thin env token resolve by host class. */
export function getResolveTokenForHost(): (host: string, env?: NodeJS.ProcessEnv) => unknown {
  return pickExport(
    ["resolveTokenForHost", "resolveMarketplaceTokenForHost", "resolveAuthTokenForHost"],
    "thin resolveTokenForHost",
  ) as (host: string, env?: NodeJS.ProcessEnv) => unknown;
}

export function getCheckMarketplaceAuthoring(): (
  opts: Record<string, unknown>,
) => Promise<{ ok: boolean; exitCode: number; errors: string[]; warnings: string[] }> {
  return pickExport(
    ["checkMarketplaceAuthoring", "checkAuthoringMarketplace", "runMarketplaceAuthoringCheck"],
    "authoring check",
  ) as (
    opts: Record<string, unknown>,
  ) => Promise<{ ok: boolean; exitCode: number; errors: string[]; warnings: string[] }>;
}

export function getResolveMarketplacePackages(): (
  opts: Record<string, unknown>,
) => Promise<unknown> {
  return pickExport(
    ["resolveMarketplacePackages", "resolveAuthoringPackages", "resolveMarketplacePackPackages"],
    "pack resolve packages",
  ) as (opts: Record<string, unknown>) => Promise<unknown>;
}

export const FIXTURE_MP = `{
  "name": "hosts-auth-mp",
  "plugins": [
    { "name": "demo-plugin", "description": "Demo", "source": "./plugins/demo", "version": "1.0.0" }
  ]
}`;

export type TempDir = { path: string; cleanup: () => void };

export function createTempDir(prefix = "bapm-mp-hosts-auth-"): TempDir {
  const path = mkdtempSync(join(tmpdir(), prefix));
  return { path, cleanup: () => rmSync(path, { recursive: true, force: true }) };
}

export function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

/** Snapshot + restore selected env keys around a test body. */
export async function withEnv<T>(
  patch: Record<string, string | undefined>,
  fn: () => Promise<T> | T,
): Promise<T> {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(patch)) {
    prev[key] = process.env[key];
    const next = patch[key];
    if (next === undefined) delete process.env[key];
    else process.env[key] = next;
  }
  try {
    return await fn();
  } finally {
    for (const key of Object.keys(patch)) {
      const v = prev[key];
      if (v === undefined) delete process.env[key];
      else process.env[key] = v;
    }
  }
}

export function tokenPayload(resolved: unknown): {
  token?: string;
  source?: string;
} {
  if (resolved == null) return {};
  if (typeof resolved === "string") return { token: resolved };
  if (typeof resolved !== "object") return {};
  const o = resolved as Record<string, unknown>;
  const token =
    (typeof o.token === "string" && o.token) ||
    (typeof o.value === "string" && o.value) ||
    (typeof o.pat === "string" && o.pat) ||
    undefined;
  const source =
    (typeof o.source === "string" && o.source) ||
    (typeof o.sourceId === "string" && o.sourceId) ||
    (typeof o.env === "string" && o.env) ||
    (typeof o.name === "string" && o.name) ||
    undefined;
  return { token, source };
}

export function hasUsableToken(resolved: unknown): boolean {
  const { token } = tokenPayload(resolved);
  return Boolean(token && token.length > 0);
}

export { core, join };
