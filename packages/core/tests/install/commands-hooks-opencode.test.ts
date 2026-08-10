/**
 * OpenCode commands deploy; hooks explicit non-fatal skip.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createOpencodeIntegration } from "@b-apm/integration-opencode";
import {
  createOpencodeRegistry,
  createTempProject,
  cursorCommandPrompt,
  cursorFlatHookJson,
  getRunInstall,
  reportDiagnostics,
  writeApmPackage,
  writeText,
  type TempProject,
} from "./commands-hooks-helpers.ts";

describe("commands/hooks OpenCode install materialize", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("command deploys to .opencode/commands/<name>.md without MCP side effects", async () => {
    project = createTempProject();
    writeApmPackage(join(project.cwd, "cmd-dep"), "cmd-dep", {
      prompts: { "review-pr": cursorCommandPrompt("review-pr") },
    });
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: oc-cmd\nversion: 0.0.1\ntarget: opencode\ndependencies:\n  apm:\n    - path: ./cmd-dep\n`,
      "utf8",
    );
    mkdirSync(join(project.cwd, ".opencode"), { recursive: true });

    const registry = createOpencodeRegistry();
    await getRunInstall()({
      cwd: project.cwd,
      frozen: false,
      integrationRegistry: registry,
      registry,
    });

    const dest = join(project.cwd, ".opencode", "commands", "review-pr.md");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf8")).toMatch(/review-pr|Review carefully/i);
    expect(existsSync(join(project.cwd, "opencode.json"))).toBe(false);
  });

  test("hook is skipped with inspectable diagnostic and writes no OpenCode hooks file", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".opencode"), { recursive: true });
    const hookSrc = join(project.cwd, "pre-tool.json");
    const cmdSrc = join(project.cwd, "keep.prompt.md");
    writeText(hookSrc, cursorFlatHookJson("./scripts/x.sh"));
    writeText(cmdSrc, cursorCommandPrompt("keep-me"));

    const report = await createOpencodeIntegration().materialize(
      [
        {
          name: "pre-tool",
          type: "hook",
          source: "local",
          path: hookSrc,
        },
        {
          name: "keep-me",
          type: "command",
          source: "local",
          path: cmdSrc,
        },
      ],
      {
        cwd: project.cwd,
        targetId: "opencode",
        deployRoots: [".opencode"],
      },
    );

    expect(existsSync(join(project.cwd, ".opencode", "commands", "keep-me.md"))).toBe(true);
    expect(existsSync(join(project.cwd, ".opencode", "hooks.json"))).toBe(false);
    expect(existsSync(join(project.cwd, ".opencode", "hooks"))).toBe(false);

    const diags = reportDiagnostics(report);
    expect(diags.length).toBeGreaterThan(0);
    expect(JSON.stringify(diags)).toMatch(/hook|skip|not supported|unsupported/i);
  });
});
