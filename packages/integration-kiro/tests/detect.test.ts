/**
 * Detect: project .kiro/ directory; never mkdir solely for detect.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, loadKiroIntegration } from "./helpers.ts";

describe("kiro detect", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("detects existing .kiro/ directory", async () => {
    const project = createTempProject("bapm-kiro-detect-yes-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".kiro"), { recursive: true });

    const target = loadKiroIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(true);
  });

  test("empty project is not Kiro and detect does not create .kiro", async () => {
    const project = createTempProject("bapm-kiro-detect-none-");
    cleanup = project.cleanup;

    const target = loadKiroIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
    expect(existsSync(join(project.cwd, ".kiro"))).toBe(false);
  });
});
