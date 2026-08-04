/**
 * M6 lifecycle/integrity acceptance helpers.
 * Domain APIs are expected from @bapm/core (apply phase); getters fail closed when missing → RED.
 */
import * as core from "@bapm/core";
import { loadLockfile } from "@bapm/core";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createFakePorts,
  createTempProject,
  depsOf,
  ensureDir,
  expectRejectsMatching,
  existingLockPath,
  fakeCommit,
  listFilesRecursive,
  lockOf,
  modulesDir,
  readLockBytes,
  writeLock,
  writeManifest,
  writeText,
  type TempProject,
} from "../../install/helpers.ts";

export {
  createFakePorts,
  createTempProject,
  depsOf,
  ensureDir,
  expectRejectsMatching,
  existingLockPath,
  fakeCommit,
  listFilesRecursive,
  lockOf,
  modulesDir,
  readLockBytes,
  writeLock,
  writeManifest,
  writeText,
  type TempProject,
};
type AnyFn = (...args: never[]) => unknown;

function pickExport(names: string[]): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(
    `expected @bapm/core to export one of [${names.join(", ")}] (M6 lifecycle/integrity public API)`,
  );
}

/** Full/scoped update (rs-011/rs-012) + dry-run / yes / frozen refuse. */
export function getRunUpdate(): (options: Record<string, unknown>) => Promise<unknown> {
  return pickExport(["runUpdate", "updateProject", "update"]) as (
    options: Record<string, unknown>,
  ) => Promise<unknown>;
}

/** Compare lock pins to remote tips. */
export function getRunOutdated(): (options: Record<string, unknown>) => Promise<unknown> {
  return pickExport(["runOutdated", "checkOutdated", "outdated"]) as (
    options: Record<string, unknown>,
  ) => Promise<unknown>;
}

export function getRunUninstall(): (options: Record<string, unknown>) => Promise<unknown> {
  return pickExport(["runUninstall", "uninstallPackages", "uninstall"]) as (
    options: Record<string, unknown>,
  ) => Promise<unknown>;
}

export function getRunPrune(): (options: Record<string, unknown>) => Promise<unknown> {
  return pickExport(["runPrune", "pruneModules", "prune"]) as (
    options: Record<string, unknown>,
  ) => Promise<unknown>;
}

export function getDepsList(): (options: Record<string, unknown>) => Promise<unknown> | unknown {
  return pickExport(["listDeps", "depsList", "runDepsList"]);
}

export function getDepsTree(): (options: Record<string, unknown>) => Promise<unknown> | unknown {
  return pickExport(["treeDeps", "depsTree", "runDepsTree"]);
}

/** Optional SHOULD (rs-005); returns undefined when deferred. */
export function getDepsWhyOptional():
  | ((options: Record<string, unknown>) => Promise<unknown> | unknown)
  | undefined {
  const c = core as Record<string, unknown>;
  for (const name of ["whyDeps", "depsWhy", "runDepsWhy"] as const) {
    if (typeof c[name] === "function") {
      return c[name] as (options: Record<string, unknown>) => Promise<unknown> | unknown;
    }
  }
  return undefined;
}

export function getRunAuditCi(): (options: Record<string, unknown>) => Promise<unknown> {
  return pickExport(["runAuditCi", "auditCi", "runAudit"]) as (
    options: Record<string, unknown>,
  ) => Promise<unknown>;
}

export function getRunDoctor(): (options: Record<string, unknown>) => Promise<unknown> {
  return pickExport(["runDoctor", "doctor", "checkDoctor"]) as (
    options: Record<string, unknown>,
  ) => Promise<unknown>;
}

export function sha256Hex(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function exitCodeOf(result: unknown): number {
  if (typeof result === "number") return result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    for (const key of ["exitCode", "code", "status", "ok"] as const) {
      if (key === "ok" && typeof r.ok === "boolean") return r.ok ? 0 : 1;
      if (typeof r[key] === "number") return r[key] as number;
    }
  }
  throw new TypeError("expected numeric exit code or { exitCode | code | status | ok }");
}

export function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    for (const key of ["rows", "packages", "dependencies", "items", "report"] as const) {
      if (Array.isArray(r[key])) return r[key] as Record<string, unknown>[];
    }
  }
  throw new TypeError("expected rows array or { rows | packages | dependencies | items }");
}

export function textOf(result: unknown): string {
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    for (const key of ["text", "output", "stdout", "message", "plan"] as const) {
      if (typeof r[key] === "string") return r[key] as string;
      if (Array.isArray(r[key])) return (r[key] as unknown[]).map(String).join("\n");
    }
  }
  return String(result ?? "");
}

export function diagnosticsText(result: unknown): string {
  if (!result || typeof result !== "object") return textOf(result);
  const r = result as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ["diagnostics", "errors", "violations", "messages", "findings"] as const) {
    if (Array.isArray(r[key])) parts.push(...(r[key] as unknown[]).map(String));
    else if (typeof r[key] === "string") parts.push(r[key] as string);
  }
  parts.push(textOf(result));
  return parts.join("\n");
}

export function pinOf(dep: Record<string, unknown>): string {
  return String(
    dep.resolved_commit ?? dep.resolvedCommit ?? dep.commit ?? dep.resolved_tag ?? dep.version ?? "",
  );
}

export function nameOfDep(dep: Record<string, unknown>): string {
  return String(dep.name ?? dep.id ?? dep.repo_url ?? dep.repoUrl ?? "");
}

export function readManifestText(cwd: string): string {
  for (const name of ["bapm.yml", "apm.yml"] as const) {
    try {
      return readFileSync(join(cwd, name), "utf8");
    } catch {
      /* try next */
    }
  }
  throw new Error("expected manifest on disk");
}

export function loadLockDeps(cwd: string): Record<string, unknown>[] {
  if (!existingLockPath(cwd)) throw new Error("expected lockfile");
  return depsOf(lockOf(loadLockfile({ cwd })));
}
