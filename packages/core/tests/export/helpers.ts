/**
 * Helpers for Export / SBOM suite.
 */
import { asText } from "../asText.ts";
import * as core from "@b-apm/core";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

type AnyFn = (...args: never[]) => unknown;

export function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @b-apm/core to export one of [${names.join(", ")}] (${label})`);
}

export function getExportSbom(): (options: Record<string, unknown>) => unknown {
  return pickExport(["exportSbom", "exportLockSbom", "exportLockfileSbom"], "lock SBOM export") as (
    options: Record<string, unknown>,
  ) => unknown;
}

/** Normalize exportSbom return shapes to SBOM JSON text. */
export function sbomText(result: unknown): string {
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (r.ok === false) {
      throw new Error(asText(r.error ?? r.message ?? "exportSbom failed"));
    }
    if (typeof r.json === "string") return r.json;
    if (typeof r.sbom === "string") return r.sbom;
    if (typeof r.body === "string") return r.body;
    if (typeof r.output === "string") return r.output;
    if (r.document && typeof r.document === "object") {
      return JSON.stringify(r.document);
    }
  }
  throw new Error(`unexpected exportSbom result: ${typeof result}`);
}

export function isExportFailure(result: unknown): boolean {
  if (result == null) return true;
  if (typeof result === "object" && (result as { ok?: unknown }).ok === false) return true;
  return false;
}

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-export-"): TempProject {
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

export function sampleLockDocument(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    lockfile_version: "1",
    generated_at: "2024-06-01T12:00:00Z",
    dependencies: [
      {
        name: "example-one",
        repo_url: "github.com/example/one",
        resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        resolved_url: "https://user:token@github.com/example/one.git?token=secret",
      },
      {
        name: "local-leaf",
        repo_url: "local:./leaf",
        source: "local",
        version: "0.0.1",
      },
    ],
    ...overrides,
  };
}
