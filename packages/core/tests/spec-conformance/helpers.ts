/**
 * Mode B helpers — paths into vendored OpenAPM §12.4 fixtures at repo root.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const coreRoot = resolve(here, "../..");
export const repoRoot = resolve(coreRoot, "../..");
export const fixtureRoot = join(repoRoot, "tests/fixtures/spec-conformance");

export function fixturePath(...parts: string[]): string {
  return join(fixtureRoot, ...parts);
}

export function readFixture(...parts: string[]): string {
  return readFileSync(fixturePath(...parts), "utf8");
}

export function normalizeTrailingNewline(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/\n+$/, "\n");
}
