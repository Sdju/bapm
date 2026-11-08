/**
 * Shared helpers for @b-apm/integration-hermes runtime tests.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { BapmIntegration, MaterializeReport } from "@b-apm/integration-api";
import { createHermesIntegration, createIntegration } from "../src/index.ts";

export function createTempProject(prefix = "bapm-hermes-"): {
  cwd: string;
  cleanup: () => void;
} {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

export function loadHermesIntegration(): BapmIntegration {
  if (createIntegration !== createHermesIntegration) {
    throw new Error("createIntegration must alias createHermesIntegration");
  }
  return createHermesIntegration();
}

export function reportDiagnostics(
  report: void | MaterializeReport | undefined,
): NonNullable<MaterializeReport["diagnostics"]> {
  if (report && typeof report === "object" && Array.isArray(report.diagnostics)) {
    return report.diagnostics;
  }
  return [];
}

export function writePrimitiveFile(cwd: string, relativePath: string, content: string): string {
  const abs = join(cwd, relativePath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, "utf8");
  return abs;
}

export function readUtf8(path: string): string {
  return readFileSync(path, "utf8");
}
