/**
 * core deps why / cache-clean helpers.
 */
import * as core from "@b-apm/core";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export type TempProject = { cwd: string; cleanup: () => void };

type AnyFn = (...args: never[]) => unknown;

export function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @b-apm/core to export one of [${names.join(", ")}] (${label})`);
}

export function getWhyDeps(): (options?: Record<string, unknown>) => unknown {
  return pickExport(["whyDeps", "depsWhy", "runDepsWhy"], "deps why") as (
    options?: Record<string, unknown>,
  ) => unknown;
}

export function getCacheClean(): (options?: Record<string, unknown>) => unknown {
  return pickExport(["cacheClean", "cleanModulesCache"], "cache clean") as (
    options?: Record<string, unknown>,
  ) => unknown;
}

export function createTempProject(prefix = "bapm-p6f-core-"): TempProject {
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

export function writeManifest(cwd: string, name: string): void {
  writeText(join(cwd, "bapm.yml"), `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm: []\n`);
}

export function writeLock(cwd: string, contents: string): void {
  writeText(join(cwd, "bapm.lock.yaml"), contents);
}

export const UNIQUE_SHARED_UTILS_LOCK = `lockfile_version: "1"
dependencies:
  - name: org/parent
    repo_url: https://example.com/org/parent.git
    source: git
    resolved_tag: v1.0.0
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  - name: acme/shared-utils
    repo_url: https://example.com/acme-org/shared-utils.git
    source: git
    resolved_tag: v2.0.0
    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    resolved_by:
      - org/parent
`;

export const AMBIGUOUS_BASENAME_LOCK = `lockfile_version: "1"
dependencies:
  - name: acme/shared-utils
    repo_url: https://example.com/acme-org/shared-utils.git
    source: git
    resolved_tag: v1.0.0
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  - name: other/shared-utils
    repo_url: https://example.com/other-org/shared-utils.git
    source: git
    resolved_tag: v2.0.0
    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
`;

export const EXACT_WINS_BASENAME_LOCK = `lockfile_version: "1"
dependencies:
  - name: shared-utils
    repo_url: https://example.com/named/exact-pkg.git
    source: git
    resolved_tag: v1.0.0
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  - name: other/shared-utils
    repo_url: https://example.com/other-org/shared-utils.git
    source: git
    resolved_tag: v2.0.0
    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
`;

export const TRANSITIVE_LOCK = `lockfile_version: "1"
dependencies:
  - name: org/parent
    repo_url: https://example.com/org/parent.git
    source: git
    resolved_tag: v1.0.0
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  - name: org/child
    repo_url: https://example.com/org/child.git
    source: git
    resolved_tag: v2.0.0
    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    resolved_by:
      - org/parent
`;

export function writeUniqueSharedUtilsLock(cwd: string): void {
  writeLock(cwd, UNIQUE_SHARED_UTILS_LOCK);
}

export function writeAmbiguousBasenameLock(cwd: string): void {
  writeLock(cwd, AMBIGUOUS_BASENAME_LOCK);
}

export function writeExactWinsBasenameLock(cwd: string): void {
  writeLock(cwd, EXACT_WINS_BASENAME_LOCK);
}

export function writeTransitiveLock(cwd: string): void {
  writeLock(cwd, TRANSITIVE_LOCK);
}

export function populateModules(cwd: string, entries: string[] = ["pkg-a", "pkg-b"]): void {
  for (const name of entries) {
    writeText(join(cwd, "apm_modules", name, "marker.txt"), `${name}\n`);
  }
}

export function modulesEntryCount(cwd: string): number {
  const root = join(cwd, "apm_modules");
  if (!existsSync(root)) return 0;
  return readdirSync(root).filter((n) => n !== "." && n !== "..").length;
}

export function exitCodeOf(result: unknown): number {
  if (typeof result === "number") return result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (typeof r.exitCode === "number") return r.exitCode;
    if (typeof r.code === "number") return r.code;
    if (typeof r.ok === "boolean") return r.ok ? 0 : 1;
  }
  throw new TypeError("expected { exitCode } or numeric exit");
}

export function asRecord(result: unknown): Record<string, unknown> {
  if (!result || typeof result !== "object") {
    throw new TypeError("expected why result object");
  }
  return result as Record<string, unknown>;
}

export function textOf(result: unknown): string {
  const r = asRecord(result);
  for (const key of ["text", "output", "message"] as const) {
    if (typeof r[key] === "string") return r[key] as string;
  }
  return JSON.stringify(result);
}

export { join };
