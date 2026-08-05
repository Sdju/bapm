/**
 * p7d — CLI compile -v/--verbose thin source attribution (compile-agents-md).
 * MUST: name + type + path when known; no optimizer / multi-host claims.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  agentsPath,
  createTempProject,
  existsSync,
  expectKnownCommand,
  expectKnownCompileFlag,
  runInProject,
  writeCompileProject,
  type TempProject,
} from "./helpers.ts";

describe("p7d CLI compile verbose attribution", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("compile -v emits thin name/type/path attribution", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd, "p7d-verbose");

    const { result, stdout, combined } = await runInProject(project.cwd, ["compile", "-v"]);
    expectKnownCommand(combined, "compile");
    expectKnownCompileFlag(combined, "-v");
    expect(result).toBe(0);
    expect(existsSync(agentsPath(project.cwd))).toBe(true);

    const text = stdout.join("\n");
    expect(text).toMatch(/style/i);
    expect(text).toMatch(/instruction/i);
    expect(text).toMatch(/style\.md|\.apm[/\\]instructions/i);
    expect(text).not.toMatch(/optimizer|distributed placement|CLAUDE\.md|GEMINI\.md/i);
  });

  test("compile --verbose --dry-run attributes without write", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd, "p7d-verbose-dry");

    const { result, stdout, combined } = await runInProject(project.cwd, [
      "compile",
      "--verbose",
      "--dry-run",
    ]);
    expectKnownCommand(combined, "compile");
    expectKnownCompileFlag(combined, "--verbose");
    expectKnownCompileFlag(combined, "--dry-run");
    expect(result).toBe(0);
    expect(existsSync(agentsPath(project.cwd))).toBe(false);

    const text = stdout.join("\n");
    expect(text).toMatch(/style/i);
    expect(text).toMatch(/instruction/i);
    expect(text).toMatch(/style\.md|\.apm[/\\]instructions/i);
    expect(text).toMatch(/dry-run|would write/i);
  });
});
