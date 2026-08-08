/**
 * Detect: `.gemini/` directory or project-root `GEMINI.md`; never mkdir solely for detect.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, loadGeminiIntegration } from "./helpers.ts";

describe("gemini detect", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("detects .gemini/ directory", async () => {
    const project = createTempProject("bapm-gemini-detect-dir-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".gemini"), { recursive: true });

    const target = loadGeminiIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(true);
  });

  test("detects project-root GEMINI.md file alone", async () => {
    const project = createTempProject("bapm-gemini-detect-md-");
    cleanup = project.cleanup;
    writeFileSync(join(project.cwd, "GEMINI.md"), "# Gemini\n", "utf8");

    const target = loadGeminiIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(true);
    expect(existsSync(join(project.cwd, ".gemini"))).toBe(false);
  });

  test("empty project is not Gemini and detect does not create roots", async () => {
    const project = createTempProject("bapm-gemini-detect-none-");
    cleanup = project.cleanup;

    const target = loadGeminiIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
    expect(existsSync(join(project.cwd, ".gemini"))).toBe(false);
    expect(existsSync(join(project.cwd, "GEMINI.md"))).toBe(false);
    expect(existsSync(join(project.cwd, ".agents"))).toBe(false);
  });

  test("lone .agents/ without gemini signals is not Gemini", async () => {
    const project = createTempProject("bapm-gemini-detect-agents-only-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".agents", "skills"), { recursive: true });

    const target = loadGeminiIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
  });
});
