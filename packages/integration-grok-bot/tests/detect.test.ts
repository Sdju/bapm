/**
 * Detect: never auto-detect; presence of agent-data/ is not a Grok Bot marker.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, loadGrokBotIntegration } from "./helpers.ts";

describe("grok-bot detect", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("empty project is not detected and detect does not create agent-data/", async () => {
    const project = createTempProject("bapm-grok-bot-detect-none-");
    cleanup = project.cleanup;

    const target = loadGrokBotIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
    expect(existsSync(join(project.cwd, "agent-data"))).toBe(false);
  });

  test("existing agent-data/workflows/ still does not detect", async () => {
    const project = createTempProject("bapm-grok-bot-detect-workflows-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, "agent-data", "workflows"), { recursive: true });

    const target = loadGrokBotIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
  });

  test("existing agent-data/ directory still does not detect", async () => {
    const project = createTempProject("bapm-grok-bot-detect-root-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, "agent-data"), { recursive: true });

    const target = loadGrokBotIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
  });
});
