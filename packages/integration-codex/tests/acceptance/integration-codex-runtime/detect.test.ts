/**
 * Detect: project-root `.codex/` directory only; never invents signals / mkdir.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCodexIntegration } from "../../../src/createCodexIntegration.ts";
import { createTempProject, type TempProject } from "./helpers.ts";

describe("codex detect", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("detects .codex/ directory", async () => {
    project = createTempProject("bapm-codex-detect-dir-");
    mkdirSync(join(project.cwd, ".codex"), { recursive: true });
    const target = createCodexIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(true);
  });

  test("lone AGENTS.md is not Codex", async () => {
    project = createTempProject("bapm-codex-detect-agents-md-");
    writeFileSync(join(project.cwd, "AGENTS.md"), "# Agents\n", "utf8");
    const target = createCodexIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
    expect(existsSync(join(project.cwd, ".codex"))).toBe(false);
  });

  test("no Codex signal → detect false and does not create .codex/", async () => {
    project = createTempProject("bapm-codex-detect-none-");
    const target = createCodexIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
    expect(existsSync(join(project.cwd, ".codex"))).toBe(false);
  });
});
