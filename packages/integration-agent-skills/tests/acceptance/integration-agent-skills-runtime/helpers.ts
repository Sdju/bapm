/**
 * Shared helpers for integration-agent-skills-runtime acceptance (RED).
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { BapmIntegration, MaterializeReport } from "@bapm/integration-api";
import { createAgentSkillsIntegration, createIntegration } from "../../../src/index.ts";

export function createTempProject(prefix = "bapm-agent-skills-"): {
  cwd: string;
  cleanup: () => void;
} {
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

export function loadAgentSkillsIntegration(): BapmIntegration {
  expectCreateIntegrationAlias();
  return createAgentSkillsIntegration();
}

function expectCreateIntegrationAlias(): void {
  if (createIntegration !== createAgentSkillsIntegration) {
    throw new Error("createIntegration must alias createAgentSkillsIntegration");
  }
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
