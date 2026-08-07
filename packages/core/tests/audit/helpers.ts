/**
 * Core audit structured-format test helpers (p6b).
 */
import * as core from "@bapm/core";
import { createHash } from "node:crypto";
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

export function getRunAuditCi(): (options: Record<string, unknown>) => Promise<unknown> {
  return pickExport(["runAuditCi", "auditCi", "runAudit"], "audit CI gate") as (
    options: Record<string, unknown>,
  ) => Promise<unknown>;
}

export function getFormatAuditCiJson(): (result: unknown) => string {
  return pickExport(
    ["formatAuditCiJson", "serializeAuditCiJson", "toAuditCiJson"],
    "audit CI JSON serializer",
  ) as (result: unknown) => string;
}

export function getFormatAuditCiSarif(): (result: unknown) => string {
  return pickExport(
    ["formatAuditCiSarif", "serializeAuditCiSarif", "toAuditCiSarif"],
    "audit CI SARIF serializer",
  ) as (result: unknown) => string;
}

export function createTempProject(prefix = "bapm-p6b-core-"): TempProject {
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

export function sha256Hex(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function exitCodeOf(result: unknown): number {
  if (typeof result === "number") return result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (typeof r.exitCode === "number") return r.exitCode;
    if (typeof r.code === "number") return r.code;
    if (typeof r.ok === "boolean") return r.ok ? 0 : 1;
  }
  throw new TypeError("expected numeric exit code or { exitCode | code | ok }");
}

export function checksOf(result: unknown): Array<Record<string, unknown>> {
  if (!result || typeof result !== "object") {
    throw new TypeError("expected AuditCiResult object with checks");
  }
  const r = result as Record<string, unknown>;
  if (!Array.isArray(r.checks)) {
    throw new TypeError("expected AuditCiResult.checks array (structured CI taxonomy)");
  }
  return r.checks as Array<Record<string, unknown>>;
}

export function checkNames(checks: Array<Record<string, unknown>>): string[] {
  return checks.map((c) => String(c.name ?? ""));
}

export function writeCleanLocalProject(
  cwd: string,
  name: string,
): { rel: string; content: string } {
  writeText(join(cwd, "bapm.yml"), `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm: []\n`);
  const rel = ".agents/skills/hello/SKILL.md";
  const content = "---\nname: hello\n---\n# Hello\n";
  writeText(join(cwd, rel), content);
  writeText(
    join(cwd, "bapm.lock.yaml"),
    `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n    deployed_file_hashes:\n      "${rel}": "${sha256Hex(content)}"\n`,
  );
  return { rel, content };
}

export function writeTamperedHashProject(cwd: string, name: string): { rel: string } {
  writeText(join(cwd, "bapm.yml"), `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm: []\n`);
  const rel = ".agents/skills/hello/SKILL.md";
  writeText(join(cwd, rel), "TAMPERED\n");
  writeText(
    join(cwd, "bapm.lock.yaml"),
    `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n    deployed_file_hashes:\n      "${rel}": "${sha256Hex("good\n")}"\n`,
  );
  return { rel };
}

export function writeMissingTreeProject(cwd: string, name: string): void {
  writeText(join(cwd, "bapm.yml"), `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm: []\n`);
  const rel = ".agents/skills/hello/SKILL.md";
  const content = "ok\n";
  writeText(join(cwd, rel), content);
  writeText(
    join(cwd, "bapm.lock.yaml"),
    `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/git-pkg\n    name: git-pkg\n    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"\n    deployed_file_hashes:\n      "${rel}": "${sha256Hex(content)}"\n`,
  );
}
