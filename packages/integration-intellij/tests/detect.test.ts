/**
 * Detect: IntelliJ has no project marker and must remain explicit-only.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, loadIntellijIntegration } from "./helpers.ts";

describe("intellij detect", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("empty project is not detected and detect creates nothing", async () => {
    const project = createTempProject("bapm-intellij-detect-none-");
    cleanup = project.cleanup;

    const target = loadIntellijIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
    expect(existsSync(join(project.cwd, ".idea"))).toBe(false);
    expect(existsSync(join(project.cwd, ".github"))).toBe(false);
  });

  test("a .idea directory is still not a JetBrains Copilot MCP marker", async () => {
    const project = createTempProject("bapm-intellij-detect-idea-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".idea"), { recursive: true });

    const target = loadIntellijIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
  });
});
