/**
 * Shared fixtures for integration-codex-runtime acceptance (RED).
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MaterializeReport } from "@bapm/integration-api";

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-codex-acc-"): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

export function reportDiagnostics(
  report: void | MaterializeReport | undefined,
): NonNullable<MaterializeReport["diagnostics"]> {
  if (report && typeof report === "object" && Array.isArray(report.diagnostics)) {
    return report.diagnostics;
  }
  return [];
}
