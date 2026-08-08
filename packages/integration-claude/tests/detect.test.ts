/**
 * Detect: .claude/ directory or project-root CLAUDE.md; never invents signals
 * (promoted from integration-claude-runtime acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClaudeIntegration } from "../src/createClaudeIntegration.ts";

describe("claude detect", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("detects .claude/ directory", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-detect-dir-"));
    mkdirSync(join(cwd, ".claude"), { recursive: true });
    const target = createClaudeIntegration();
    expect(await target.detect({ cwd })).toBe(true);
  });

  test("detects CLAUDE.md without .claude/", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-detect-md-"));
    writeFileSync(join(cwd, "CLAUDE.md"), "# Claude\n", "utf8");
    const target = createClaudeIntegration();
    expect(await target.detect({ cwd })).toBe(true);
    expect(existsSync(join(cwd, ".claude"))).toBe(false);
  });

  test("no Claude signal → detect false and does not create paths", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-detect-none-"));
    const target = createClaudeIntegration();
    expect(await target.detect({ cwd })).toBe(false);
    expect(existsSync(join(cwd, ".claude"))).toBe(false);
    expect(existsSync(join(cwd, "CLAUDE.md"))).toBe(false);
  });
});
