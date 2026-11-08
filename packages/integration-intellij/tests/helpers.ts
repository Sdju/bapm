/**
 * Shared helpers for @b-apm/integration-intellij runtime tests.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { BapmIntegration } from "@b-apm/integration-api";
import { createIntegration, createIntellijIntegration } from "../src/index.ts";

export function createTempProject(prefix = "bapm-intellij-"): {
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
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeText(cwd: string, relativePath: string, content: string): string {
  const abs = join(cwd, relativePath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, "utf8");
  return abs;
}

export function loadIntellijIntegration(): BapmIntegration {
  if (createIntegration !== createIntellijIntegration) {
    throw new Error("createIntegration must alias createIntellijIntegration");
  }
  return createIntellijIntegration();
}
