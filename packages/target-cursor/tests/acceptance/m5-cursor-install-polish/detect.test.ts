/**
 * M5 acceptance: cursor detect — `.cursor/` dir and legacy `.cursorrules` file.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCursorTarget } from "../../../src/index.ts";

describe("M5 cursor detect", () => {
  let cwd: string;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
  });

  test("detects .cursor/ directory", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-m5-detect-dir-"));
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
    const target = createCursorTarget();
    expect(target.detect({ cwd })).toBe(true);
  });

  test("detects legacy .cursorrules file without .cursor/", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-m5-detect-legacy-"));
    writeFileSync(join(cwd, ".cursorrules"), "# legacy cursor rules\n", "utf8");
    const target = createCursorTarget();
    expect(target.detect({ cwd })).toBe(true);
  });

  test("no signal → detect false", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-m5-detect-none-"));
    const target = createCursorTarget();
    expect(target.detect({ cwd })).toBe(false);
  });
});
