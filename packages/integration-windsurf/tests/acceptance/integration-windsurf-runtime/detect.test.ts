/**
 * Detect: `.windsurf/` directory; never mkdir solely for detect
 * (integration-windsurf-runtime acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, loadWindsurfIntegration } from "./helpers.ts";

describe("windsurf detect", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("detects .windsurf directory", async () => {
    const project = createTempProject("bapm-windsurf-detect-dir-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".windsurf"), { recursive: true });

    const target = loadWindsurfIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(true);
  });

  test("empty project is not Windsurf and detect does not create roots", async () => {
    const project = createTempProject("bapm-windsurf-detect-none-");
    cleanup = project.cleanup;

    const target = loadWindsurfIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
    expect(existsSync(join(project.cwd, ".windsurf"))).toBe(false);
    expect(existsSync(join(project.cwd, ".agents"))).toBe(false);
  });

  test("lone .agents/ without .windsurf is not Windsurf", async () => {
    const project = createTempProject("bapm-windsurf-detect-agents-only-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".agents", "skills"), { recursive: true });

    const target = loadWindsurfIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
    expect(existsSync(join(project.cwd, ".windsurf"))).toBe(false);
  });
});
