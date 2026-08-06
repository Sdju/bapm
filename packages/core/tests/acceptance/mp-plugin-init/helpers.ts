/**
 * Core helpers for mp-plugin-init acceptance (Manifest plugin scaffold APIs).
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
export const coreRoot = resolve(suiteDir, "../../..");
export const srcRoot = join(coreRoot, "src");

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-mp-plugin-init-core-"): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function writeText(path: string, contents: string): void {
  ensureDir(dirname(path));
  writeFileSync(path, contents, "utf8");
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

export function readSrc(rel: string): string {
  return readFileSync(join(srcRoot, rel), "utf8");
}

type AnyFn = (...args: never[]) => unknown;

export function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @bapm/core to export one of [${names.join(", ")}] (${label})`);
}

export function getValidatePluginName(): (name: string) => unknown {
  return pickExport(
    ["validatePluginName", "isValidPluginName", "assertPluginName"],
    "plugin name validate",
  ) as (name: string) => unknown;
}

export function getValidateProjectName(): (name: string) => unknown {
  return pickExport(
    ["validateProjectName", "isValidProjectName", "assertProjectName"],
    "project name validate",
  ) as (name: string) => unknown;
}

export function getCreateMinimalManifest(): (options: Record<string, unknown>) => unknown {
  return pickExport(["createMinimalManifest", "createMinimalManifestDocument"], "minimal manifest") as (
    options: Record<string, unknown>,
  ) => unknown;
}

export function getCreatePluginJson(): (options: Record<string, unknown>) => unknown {
  return pickExport(
    ["createPluginJson", "createPluginJsonDocument", "buildPluginJson"],
    "plugin.json create",
  ) as (options: Record<string, unknown>) => unknown;
}

export function getWritePluginJson(): (
  options: Record<string, unknown>,
) => unknown {
  return pickExport(
    ["writePluginJson", "writePluginJsonFile", "emitPluginJson"],
    "plugin.json write",
  ) as (options: Record<string, unknown>) => unknown;
}

/** Normalize validator result: boolean, {ok}, or throw-on-invalid. */
export function acceptsName(fn: (name: string) => unknown, name: string): boolean {
  try {
    const result = fn(name);
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

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  throw new TypeError(`expected object, got ${typeof value}`);
}

export { core, existsSync, join };
