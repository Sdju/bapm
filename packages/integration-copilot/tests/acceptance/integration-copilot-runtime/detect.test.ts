/**
 * Detect: APM SIGNAL_WHITELIST under .github/; never mkdir solely for detect
 * (integration-copilot-runtime acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, loadCopilotIntegration } from "./helpers.ts";

describe("copilot detect", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test.each([
    {
      name: "copilot-instructions.md file",
      setup: (cwd: string) => {
        mkdirSync(join(cwd, ".github"), { recursive: true });
        writeFileSync(join(cwd, ".github", "copilot-instructions.md"), "# Copilot\n", "utf8");
      },
    },
    {
      name: ".github/instructions/ directory",
      setup: (cwd: string) => {
        mkdirSync(join(cwd, ".github", "instructions"), { recursive: true });
      },
    },
    {
      name: ".github/agents/ directory",
      setup: (cwd: string) => {
        mkdirSync(join(cwd, ".github", "agents"), { recursive: true });
      },
    },
    {
      name: ".github/prompts/ directory",
      setup: (cwd: string) => {
        mkdirSync(join(cwd, ".github", "prompts"), { recursive: true });
      },
    },
    {
      name: ".github/hooks/ directory",
      setup: (cwd: string) => {
        mkdirSync(join(cwd, ".github", "hooks"), { recursive: true });
      },
    },
  ])("detects whitelist signal alone: $name", async ({ setup }) => {
    const project = createTempProject("bapm-copilot-detect-signal-");
    cleanup = project.cleanup;
    setup(project.cwd);

    const target = loadCopilotIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(true);
  });

  test("empty project is not Copilot and detect does not create roots", async () => {
    const project = createTempProject("bapm-copilot-detect-none-");
    cleanup = project.cleanup;

    const target = loadCopilotIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
    expect(existsSync(join(project.cwd, ".github"))).toBe(false);
    expect(existsSync(join(project.cwd, ".agents"))).toBe(false);
  });

  test("lone .agents/ without whitelist signals is not Copilot", async () => {
    const project = createTempProject("bapm-copilot-detect-agents-only-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".agents", "skills"), { recursive: true });

    const target = loadCopilotIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
    expect(existsSync(join(project.cwd, ".github"))).toBe(false);
  });
});
