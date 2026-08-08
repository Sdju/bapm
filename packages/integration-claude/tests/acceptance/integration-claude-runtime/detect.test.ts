/**
 * Detect: .claude/ directory or project-root CLAUDE.md; never invents signals.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClaudeTarget, createTempDir, type TempDir } from "./helpers.ts";

describe("integration-claude-runtime · detect", () => {
  let project: TempDir | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("detects .claude/ directory", async () => {
    project = createTempDir("bapm-acc-claude-detect-dir-");
    mkdirSync(join(project.cwd, ".claude"), { recursive: true });
    const target = await createClaudeTarget();
    expect(await target.detect({ cwd: project.cwd })).toBe(true);
  });

  test("detects CLAUDE.md without .claude/", async () => {
    project = createTempDir("bapm-acc-claude-detect-md-");
    writeFileSync(join(project.cwd, "CLAUDE.md"), "# Claude\n", "utf8");
    const target = await createClaudeTarget();
    expect(await target.detect({ cwd: project.cwd })).toBe(true);
    expect(existsSync(join(project.cwd, ".claude"))).toBe(false);
  });

  test("no Claude signal → detect false and does not create paths", async () => {
    project = createTempDir("bapm-acc-claude-detect-none-");
    const target = await createClaudeTarget();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
    expect(existsSync(join(project.cwd, ".claude"))).toBe(false);
    expect(existsSync(join(project.cwd, "CLAUDE.md"))).toBe(false);
  });
});
