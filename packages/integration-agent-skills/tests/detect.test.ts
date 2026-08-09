/**
 * Detect: never auto-detect (even with .agents/); never mkdir solely for detect
 * .
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, loadAgentSkillsIntegration } from "./helpers.ts";

describe("agent-skills detect", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("empty project is not detected and detect does not create .agents/", async () => {
    const project = createTempProject("bapm-agent-skills-detect-none-");
    cleanup = project.cleanup;

    const target = loadAgentSkillsIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
    expect(existsSync(join(project.cwd, ".agents"))).toBe(false);
  });

  test("existing .agents/skills/ still does not detect", async () => {
    const project = createTempProject("bapm-agent-skills-detect-agents-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".agents", "skills"), { recursive: true });

    const target = loadAgentSkillsIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
  });

  test("existing .agents/ directory still does not detect", async () => {
    const project = createTempProject("bapm-agent-skills-detect-agents-root-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".agents"), { recursive: true });

    const target = loadAgentSkillsIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
  });
});
