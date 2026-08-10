/**
 * Shared helpers for @b-apm/integration-gemini runtime tests.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { BapmIntegration, MaterializeReport } from "@b-apm/integration-api";
import { createGeminiIntegration, createIntegration } from "../src/index.ts";

export function createTempProject(prefix = "bapm-gemini-"): {
  cwd: string;
  cleanup: () => void;
} {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

export function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

export function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function reportDiagnostics(
  report: void | MaterializeReport | undefined,
): NonNullable<MaterializeReport["diagnostics"]> {
  if (report && typeof report === "object" && Array.isArray(report.diagnostics)) {
    return report.diagnostics;
  }
  return [];
}

export function loadGeminiIntegration(): BapmIntegration {
  if (createIntegration !== createGeminiIntegration) {
    throw new Error("createIntegration must alias createGeminiIntegration");
  }
  return createGeminiIntegration();
}

export function writePrimitiveFile(cwd: string, relativePath: string, content: string): string {
  const abs = join(cwd, relativePath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, "utf8");
  return abs;
}
