/**
 * P6e outdated parity — acceptance helpers (core).
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  createFakePorts,
  createTempProject,
  depsOf,
  expectRejectsMatching,
  existingLockPath,
  fakeCommit,
  getRunOutdated,
  lockOf,
  modulesDir,
  readLockBytes,
  writeLock,
  writeManifest,
  writeText,
  type TempProject,
} from "../../lifecycle/helpers.ts";

export {
  createFakePorts,
  createTempProject,
  depsOf,
  expectRejectsMatching,
  existingLockPath,
  fakeCommit,
  getRunOutdated,
  lockOf,
  modulesDir,
  readLockBytes,
  writeLock,
  writeManifest,
  writeText,
  type TempProject,
};

export function statusOf(row: Record<string, unknown>): string {
  return String(row.status ?? row.state ?? row.result ?? "").toLowerCase();
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

function fingerprintTree(root: string): string {
  const parts: string[] = [];
  const walk = (dir: string, rel: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const childRel = rel ? `${rel}/${name}` : name;
      const st = statSync(full);
      if (st.isDirectory()) walk(full, childRel);
      else {
        const body = readFileSync(full);
        parts.push(`${childRel}:${st.size}:${createHash("sha256").update(body).digest("hex")}`);
      }
    }
  };
  if (existsSync(root)) walk(root, "");
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

/** Bit-identical contract over lock / modules / manifest / common target roots. */
export function projectFingerprint(cwd: string): string {
  const keys = [
    "bapm.yml",
    "apm.yml",
    "bapm.lock.yaml",
    "apm.lock.yaml",
    "apm_modules",
    "bapm_modules",
    ".agents",
    ".cursor",
    ".github",
  ];
  const parts: string[] = [];
  for (const key of keys) {
    const full = join(cwd, key);
    if (!existsSync(full)) continue;
    const st = statSync(full);
    if (st.isDirectory()) parts.push(`${key}:dir:${fingerprintTree(full)}`);
    else {
      const body = readFileSync(full);
      parts.push(`${key}:file:${createHash("sha256").update(body).digest("hex")}`);
    }
  }
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}
