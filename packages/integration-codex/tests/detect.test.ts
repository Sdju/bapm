/**
 * Detect: project-root `.codex/` directory only; never invents signals / mkdir
 * (promoted from integration-codex-runtime acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCodexIntegration } from "../src/createCodexIntegration.ts";

describe("codex detect", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("detects .codex/ directory", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-detect-dir-"));
    mkdirSync(join(cwd, ".codex"), { recursive: true });
    const target = createCodexIntegration();
    expect(await target.detect({ cwd })).toBe(true);
  });

  test("lone AGENTS.md is not Codex", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-detect-agents-md-"));
    writeFileSync(join(cwd, "AGENTS.md"), "# Agents\n", "utf8");
    const target = createCodexIntegration();
    expect(await target.detect({ cwd })).toBe(false);
    expect(existsSync(join(cwd, ".codex"))).toBe(false);
  });

  test("no Codex signal → detect false and does not create .codex/", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-detect-none-"));
    const target = createCodexIntegration();
    expect(await target.detect({ cwd })).toBe(false);
    expect(existsSync(join(cwd, ".codex"))).toBe(false);
  });
});
