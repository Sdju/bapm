/**
 * Core helpers for marketplace authoring (bapm.yml) suite.
 * Soft-resolve authoring Marketplace APIs from @bapm/core.
 */
import * as core from "@bapm/core";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
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
export const marketplaceSrc = join(srcRoot, "modules", "Marketplace");

type AnyFn = (...args: never[]) => unknown;

export function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @bapm/core to export one of [${names.join(", ")}] (${label})`);
}

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-mp-authoring-core-"): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

export function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

export function writeBapmYml(cwd: string, body: string): string {
  const path = join(cwd, "bapm.yml");
  writeText(path, body);
  return path;
}

export function readText(path: string): string {
  return readFileSync(path, "utf8");
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

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  throw new TypeError(`expected object, got ${typeof value}`);
}

export function readSrc(rel: string): string {
  return readFileSync(join(srcRoot, rel), "utf8");
}

/** Load authoring config from project cwd / path. */
export function getLoadMarketplaceFromBapmYml(): (input: Record<string, unknown>) => unknown {
  return pickExport(
    [
      "loadMarketplaceFromBapmYml",
      "loadMarketplaceAuthoringFromBapmYml",
      "loadAuthoringMarketplace",
    ],
    "load marketplace authoring from bapm.yml",
  ) as (input: Record<string, unknown>) => unknown;
}

export function getDetectAuthoringConfigSource(): (input: Record<string, unknown>) => unknown {
  return pickExport(
    [
      "detectAuthoringConfigSource",
      "detectMarketplaceAuthoringSource",
      "detectMarketplaceConfigSource",
    ],
    "detect authoring config source",
  ) as (input: Record<string, unknown>) => unknown;
}

export function getValidateAuthoringSource(): (source: string) => unknown {
  return pickExport(
    [
      "validateMarketplaceAuthoringSource",
      "validateAuthoringPackageSource",
      "validateMarketplaceSourceString",
      "isValidMarketplaceAuthoringSource",
    ],
    "authoring source validate",
  ) as (source: string) => unknown;
}

export function getRenderInitMarketplaceBlock(): (opts: Record<string, unknown>) => unknown {
  return pickExport(
    ["renderMarketplaceBlock", "renderInitMarketplaceBlock", "createMarketplaceAuthoringTemplate"],
    "init marketplace template",
  ) as (opts: Record<string, unknown>) => unknown;
}

export function getAuthoringEditor(): {
  add: (opts: Record<string, unknown>) => unknown;
  set: (opts: Record<string, unknown>) => unknown;
  remove: (opts: Record<string, unknown>) => unknown;
} {
  return {
    add: pickExport(
      ["addMarketplacePackage", "addAuthoringPackage", "marketplacePackageAdd"],
      "authoring package add",
    ) as (opts: Record<string, unknown>) => unknown,
    set: pickExport(
      ["setMarketplacePackage", "updateAuthoringPackage", "marketplacePackageSet"],
      "authoring package set",
    ) as (opts: Record<string, unknown>) => unknown,
    remove: pickExport(
      ["removeMarketplacePackage", "removeAuthoringPackage", "marketplacePackageRemove"],
      "authoring package remove",
    ) as (opts: Record<string, unknown>) => unknown,
  };
}

export function getCheckAuthoringMarketplace(): (
  opts: Record<string, unknown>,
) => unknown | Promise<unknown> {
  return pickExport(
    ["checkMarketplaceAuthoring", "checkAuthoringMarketplace", "runMarketplaceAuthoringCheck"],
    "authoring check",
  ) as (opts: Record<string, unknown>) => unknown | Promise<unknown>;
}

export function getMigrateMarketplaceYml(): (opts: Record<string, unknown>) => unknown {
  return pickExport(
    ["migrateMarketplaceYml", "migrateLegacyMarketplaceYml", "runMarketplaceMigrate"],
    "migrate legacy marketplace.yml",
  ) as (opts: Record<string, unknown>) => unknown;
}

/** Normalize validator result: boolean, {ok}, or throw-on-invalid. */
export function acceptsSource(fn: (source: string) => unknown, source: string): boolean {
  try {
    const result = fn(source);
    if (typeof result === "boolean") return result;
    if (result && typeof result === "object" && "ok" in result) {
      return Boolean((result as { ok: unknown }).ok);
    }
    if (result === undefined || result === null) return true;
    return Boolean(result);
  } catch {
    return false;
  }
}

export function loadFailed(result: unknown): boolean {
  if (result === undefined || result === null) return true;
  if (typeof result === "boolean") return !result;
  const row = asRecord(result);
  if (typeof row.ok === "boolean") return !row.ok;
  if (typeof row.success === "boolean") return !row.success;
  if (row.error || row.errors) return true;
  if (row.config || row.marketplace || row.name) return false;
  return false;
}

export function authoringName(result: unknown): string | undefined {
  const row = asRecord(result);
  const cfg = row.config ?? row.marketplace ?? row;
  const c = asRecord(cfg);
  return typeof c.name === "string" ? c.name : undefined;
}

export function authoringPackages(result: unknown): unknown[] {
  const row = asRecord(result);
  const cfg = row.config ?? row.marketplace ?? row;
  const c = asRecord(cfg);
  return Array.isArray(c.packages) ? c.packages : [];
}

export function detectKind(result: unknown): string {
  if (typeof result === "string") return result;
  const row = asRecord(result);
  const kind = row.kind ?? row.source ?? row.type ?? row.status;
  if (typeof kind === "string") return kind;
  throw new TypeError(`unrecognized detectAuthoringConfigSource shape: ${JSON.stringify(result)}`);
}

export function hasHostMarketplaceJsonEmit(cwd: string): boolean {
  const markers = [
    join(cwd, ".claude-plugin", "marketplace.json"),
    join(cwd, ".agents", "plugins", "marketplace.json"),
    join(cwd, "marketplace.json"),
  ];
  return markers.some((p) => existsSync(p));
}

/** Minimal valid authoring block fixture (local package). */
export function validAuthoringBapmYml(opts?: {
  name?: string;
  owner?: string;
  withOutputs?: boolean;
}): string {
  const name = opts?.name ?? "acme";
  const owner = opts?.owner ?? "acme-org";
  const outputs = opts?.withOutputs !== false;
  return [
    `name: ${name}`,
    `version: "0.1.0"`,
    `description: Acme marketplace`,
    `marketplace:`,
    `  owner: ${owner}`,
    outputs
      ? [`  build:`, `    tagPattern: "v*"`, `  outputs:`, `    claude: true`].join("\n")
      : null,
    `  packages:`,
    `    - name: demo`,
    `      source: ./plugins/demo`,
    ``,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export { core, existsSync, join };
