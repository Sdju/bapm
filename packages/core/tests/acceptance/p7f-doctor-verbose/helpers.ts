/**
 * p7f-doctor-verbose acceptance helpers (core).
 */
import * as core from "@bapm/core";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export type TempProject = { cwd: string; cleanup: () => void };

type AnyFn = (...args: never[]) => unknown;

function pickExport(names: string[]): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(
    `expected @bapm/core to export one of [${names.join(", ")}] (doctor)`,
  );
}

export function getRunDoctor(): (
  options?: Record<string, unknown>,
) => Promise<unknown> | unknown {
  return pickExport(["runDoctor", "doctor", "checkDoctor"]) as (
    options?: Record<string, unknown>,
  ) => Promise<unknown> | unknown;
}

export function createTempProject(prefix = "bapm-p7f-core-"): TempProject {
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

export function writeDoctorProject(cwd: string, name: string): void {
  writeText(
    join(cwd, "bapm.yml"),
    `name: ${name}\nversion: 9.9.9\ndependencies:\n  apm: []\n`,
  );
  writeText(
    join(cwd, "bapm.lock.yaml"),
    `lockfile_version: "1"
dependencies:
  - name: leaf
    repo_url: local:leaf
    source: local
    version: "0.0.1"
  - name: other
    repo_url: github.com/example/other
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
`,
  );
}

export function exitCodeOf(result: unknown): number {
  if (typeof result === "number") return result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (typeof r.exitCode === "number") return r.exitCode;
    if (typeof r.code === "number") return r.code;
    if (typeof r.ok === "boolean") return r.ok ? 0 : 1;
  }
  throw new TypeError("expected doctor result with exitCode");
}

export function textOf(result: unknown): string {
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (typeof r.text === "string") return r.text;
    if (Array.isArray(r.checks)) {
      return (r.checks as Array<Record<string, unknown>>)
        .map((c) => `${c.ok ? "PASS" : "FAIL"}\t${c.name}\t${c.message}`)
        .join("\n");
    }
  }
  return String(result ?? "");
}

export function checksOf(result: unknown): Array<Record<string, unknown>> {
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (Array.isArray(r.checks)) return r.checks as Array<Record<string, unknown>>;
  }
  return [];
}

export function lineForCheck(text: string, name: string): string | undefined {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => new RegExp(`^(PASS|FAIL)\\t${name}\\t`).test(l));
}

export function messageOf(result: unknown, name: string): string {
  const fromChecks = checksOf(result).find((c) => String(c.name) === name);
  if (fromChecks && typeof fromChecks.message === "string") return fromChecks.message;
  const line = lineForCheck(textOf(result), name);
  return line?.split("\t")[2] ?? "";
}

export function ensureModulesDir(cwd: string, entries: string[] = ["pkg-a"]): void {
  const root = join(cwd, "apm_modules");
  mkdirSync(root, { recursive: true });
  for (const name of entries) {
    mkdirSync(join(root, name), { recursive: true });
  }
}

export function listDirNames(path: string): string[] {
  if (!existsSync(path)) return [];
  return readdirSync(path).sort();
}

export const MARKETPLACE_NAME_PATTERN =
  /marketplace|format|duplicate|version-alignment|executable-trust|executable.?trust/i;
