/**
 * Detect: .grok/ directory only; never invents signals.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGrokBuildIntegration } from "../src/createGrokBuildIntegration.ts";

describe("grok-build detect", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("detects .grok/ directory", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-grok-u-detect-dir-"));
    mkdirSync(join(cwd, ".grok"), { recursive: true });
    const target = createGrokBuildIntegration();
    expect(await target.detect({ cwd })).toBe(true);
  });

  test("lone AGENTS.md is not grok-build", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-grok-u-detect-agents-"));
    writeFileSync(join(cwd, "AGENTS.md"), "# Agents\n", "utf8");
    const target = createGrokBuildIntegration();
    expect(await target.detect({ cwd })).toBe(false);
    expect(existsSync(join(cwd, ".grok"))).toBe(false);
  });

  test("no signal → detect false and does not create paths", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-grok-u-detect-none-"));
    const target = createGrokBuildIntegration();
    expect(await target.detect({ cwd })).toBe(false);
    expect(existsSync(join(cwd, ".grok"))).toBe(false);
  });
});
