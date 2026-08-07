/**
 * Acceptance helpers for cli-view-local-package (core view-local-inspect).
 * Behavioural fixtures only — no production source inspection.
 */
import * as core from "@bapm/core";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  throw new TypeError(`expected @bapm/core to export one of [${names.join(", ")}] (${label})`);
}

/** Public local-view orchestration (names from change design / tasks). */
export function getViewPackage(): (options?: Record<string, unknown>) => unknown {
  return pickExport(
    ["viewPackage", "runView", "viewLocalPackage", "localView"],
    "local view",
  ) as (options?: Record<string, unknown>) => unknown;
}

export function createTempProject(prefix = "bapm-view-core-"): TempProject {
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

/** Unique basename + owner/repo; pin via version field. */
export const VIEW_OK_LOCK = `lockfile_version: "1"
dependencies:
  - name: org/parent
    repo_url: https://example.com/org/parent.git
    source: git
    version: "1.0.0"
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  - name: acme/shared-utils
    repo_url: https://example.com/acme-org/shared-utils.git
    source: git
    version: "2.1.0"
    resolved_tag: v2.1.0
    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    resolved_by:
      - org/parent
`;

export const AMBIGUOUS_BASENAME_LOCK = `lockfile_version: "1"
dependencies:
  - name: acme/shared-utils
    repo_url: https://example.com/acme-org/shared-utils.git
    source: git
    version: "1.0.0"
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  - name: other/shared-utils
    repo_url: https://example.com/other-org/shared-utils.git
    source: git
    version: "2.0.0"
    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
`;

export function writeViewOkLock(cwd: string): void {
  writeLock(cwd, VIEW_OK_LOCK);
}

export function writeAmbiguousBasenameLock(cwd: string): void {
  writeLock(cwd, AMBIGUOUS_BASENAME_LOCK);
}

/** Modules tree path matching locateGitPackageTree layout for shared-utils. */
export function modulesTreeForSharedUtils(cwd: string): string {
  const normalize =
    (core as Record<string, unknown>).normalizeRepoIdentity ??
    (core as Record<string, unknown>).toLockRepoUrl;
  const toDir = (core as Record<string, unknown>).identityToCacheDir;
  if (typeof normalize !== "function" || typeof toDir !== "function") {
    throw new TypeError("expected @bapm/core identity helpers for modules fixture");
  }
  const repo = "https://example.com/acme-org/shared-utils.git";
  const identity = String((normalize as (r: string) => string)(repo));
  const dir = String((toDir as (id: string) => string)(identity));
  const commitShort = "bbbbbbbbbbbb";
  return join(cwd, "apm_modules", dir, commitShort);
}

export function writeInstalledSharedUtilsTree(
  cwd: string,
  packageManifest: string | null,
): string {
  const tree = modulesTreeForSharedUtils(cwd);
  writeText(join(tree, "marker.txt"), "shared-utils\n");
  if (packageManifest !== null) {
    writeText(join(tree, "apm.yml"), packageManifest);
  }
  return tree;
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
    throw new TypeError("expected view result object");
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

/** Identity name from flexible result shapes. */
export function identityName(result: unknown): string | undefined {
  const r = asRecord(result);
  for (const bag of [r, r.identity, r.package] as const) {
    if (bag && typeof bag === "object" && typeof (bag as Record<string, unknown>).name === "string") {
      return (bag as Record<string, unknown>).name as string;
    }
  }
  return undefined;
}

export function identityRepoUrl(result: unknown): string | undefined {
  const r = asRecord(result);
  for (const bag of [r, r.identity, r.package] as const) {
    if (
      bag &&
      typeof bag === "object" &&
      typeof (bag as Record<string, unknown>).repo_url === "string"
    ) {
      return (bag as Record<string, unknown>).repo_url as string;
    }
  }
  return undefined;
}

export function pinOf(result: unknown): string | undefined {
  const r = asRecord(result);
  for (const bag of [r, r.identity, r.package] as const) {
    if (!bag || typeof bag !== "object") continue;
    const o = bag as Record<string, unknown>;
    for (const key of ["version", "pin", "resolved_ref", "resolved_tag"] as const) {
      if (typeof o[key] === "string" && (o[key] as string).length > 0) {
        return o[key] as string;
      }
    }
  }
  return undefined;
}

export function modulesPathOf(result: unknown): string | undefined {
  const r = asRecord(result);
  for (const key of ["modulesPath", "modules_path", "path"] as const) {
    if (typeof r[key] === "string" && (r[key] as string).length > 0) {
      return r[key] as string;
    }
  }
  return undefined;
}

export function summaryOf(result: unknown): string | undefined {
  const r = asRecord(result);
  for (const key of ["summary", "description"] as const) {
    if (typeof r[key] === "string") return r[key] as string;
  }
  return undefined;
}

export { join };
