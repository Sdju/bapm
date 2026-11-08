/**
 * Detect: Hermes is explicit-only in APM; .agents/ is shared, not a marker.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, loadHermesIntegration } from "./helpers.ts";

describe("hermes detect", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("empty project is not detected and detect creates nothing", async () => {
    const project = createTempProject("bapm-hermes-detect-none-");
    cleanup = project.cleanup;

    const target = loadHermesIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
    expect(existsSync(join(project.cwd, ".agents"))).toBe(false);
  });

  test("existing .agents/skills/ still does not auto-detect", async () => {
    const project = createTempProject("bapm-hermes-detect-shared-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".agents", "skills"), { recursive: true });

    const target = loadHermesIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
  });
});
