/**
 * Helpers for ExecutableTrust suites (promoted from sc-executable-governance).
 */
import * as core from "@b-apm/core";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const suiteDir = dirname(fileURLToPath(import.meta.url));
export const coreRoot = resolve(suiteDir, "../..");
export const repoRoot = resolve(coreRoot, "../..");

export type TempDir = { cwd: string; cleanup: () => void };

export function createTempDir(prefix = "bapm-sc-exec-gov-"): TempDir {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function writeText(path: string, contents: string): string {
  ensureDir(dirname(path));
  writeFileSync(path, contents, "utf8");
  return path;
}

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}

export function readJson(path: string): unknown {
  return JSON.parse(readText(path));
}

type AnyFn = (...args: never[]) => unknown;

export function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @b-apm/core to export one of [${names.join(", ")}] (${label})`);
}

/** Layered deny-wins resolver (sc-011). */
export function getResolveExecutableTrust(): (options: Record<string, unknown>) => {
  outcome: string;
  allowed?: boolean;
  withhold?: boolean;
  packageName?: string;
  executableType?: string;
  reason?: string;
  [key: string]: unknown;
} {
  return pickExport(
    ["resolveExecutableTrust", "classifyExecutableTrust"],
    "layered resolveExecutableTrust",
  ) as ReturnType<typeof getResolveExecutableTrust>;
}

/** Audit/trust classifier twin — same resolve surface (alias OK). */
export function getClassifyExecutableTrust(): ReturnType<typeof getResolveExecutableTrust> {
  const c = core as Record<string, unknown>;
  if (typeof c.classifyExecutableTrust === "function") {
    return c.classifyExecutableTrust as ReturnType<typeof getResolveExecutableTrust>;
  }
  return getResolveExecutableTrust();
}

export function getLoadUserExecutableGrants(): (options: {
  configRoot?: string;
  configDir?: string;
}) => {
  allow?: Record<string, unknown>;
  deny?: Record<string, unknown>;
  executables?: { allow?: Record<string, unknown>; deny?: Record<string, unknown> };
  [key: string]: unknown;
} {
  return pickExport(
    [
      "loadUserExecutableGrants",
      "loadUserExecutables",
      "loadExecutableUserGrants",
      "readUserExecutableGrants",
    ],
    "user executables load",
  ) as ReturnType<typeof getLoadUserExecutableGrants>;
}

export function getSaveUserExecutableGrants(): (options: {
  configRoot?: string;
  configDir?: string;
  allow?: Record<string, unknown>;
  deny?: Record<string, unknown>;
  executables?: { allow?: Record<string, unknown>; deny?: Record<string, unknown> };
  packageName?: string;
  grant?: "allow" | "deny";
  executableType?: string;
}) => unknown {
  return pickExport(
    [
      "saveUserExecutableGrants",
      "saveUserExecutables",
      "saveExecutableUserGrants",
      "writeUserExecutableGrants",
      "persistUserExecutableGrant",
    ],
    "user executables save",
  ) as ReturnType<typeof getSaveUserExecutableGrants>;
}

/** Lockfile-presence require + withheld diagnostic (sc-012). */
export function getEvaluateRequiredPackagePresence(): (options: Record<string, unknown>) => {
  ok?: boolean;
  satisfied?: boolean;
  diagnostics?: Array<{ code?: string; message?: string; identity?: string }>;
  violations?: Array<{ code?: string; message?: string; identity?: string }>;
  codes?: string[];
  [key: string]: unknown;
} {
  return pickExport(
    [
      "evaluateRequiredPackagePresence",
      "classifyRequiredPackagePresence",
      "evaluateRequireLockPresence",
      "evaluateRequiredPackagesFromLock",
    ],
    "required package lock presence",
  ) as ReturnType<typeof getEvaluateRequiredPackagePresence>;
}

export function diagnosticsOf(result: {
  diagnostics?: Array<{ code?: string; message?: string; identity?: string }>;
  violations?: Array<{ code?: string; message?: string; identity?: string }>;
  codes?: string[];
}): Array<{ code?: string; message?: string; identity?: string }> {
  if (Array.isArray(result.diagnostics) && result.diagnostics.length) return result.diagnostics;
  if (Array.isArray(result.violations) && result.violations.length) return result.violations;
  if (Array.isArray(result.codes)) {
    return result.codes.map((code) => ({ code }));
  }
  return [];
}

export function userConfigJsonPath(configRoot: string): string {
  return join(configRoot, "config.json");
}

export function grantSurface(
  allow: Record<string, unknown> = {},
  deny: Record<string, unknown> = {},
) {
  return { present: true, allow, deny };
}
