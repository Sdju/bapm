/**
 * p7d — CLI compile -o/--output path + default AGENTS.md + no foreign hosts.
 * Spec: compile-agents-md / cli-runtime-surface.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  agentsPath,
  assertNoForeignHosts,
  createTempProject,
  existsSync,
  expectKnownCommand,
  expectKnownCompileFlag,
  join,
  readFileSync,
  runInProject,
  writeCompileProject,
  type TempProject,
} from "./helpers.ts";

describe("p7d CLI compile output path", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("default compile writes AGENTS.md and no foreign hosts", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd, "p7d-default-out");

    const { result, combined } = await runInProject(project.cwd, ["compile"]);
    expectKnownCommand(combined, "compile");
    expect(result).toBe(0);
    expect(existsSync(agentsPath(project.cwd))).toBe(true);
    expect(readFileSync(agentsPath(project.cwd), "utf8")).toMatch(/Style|concise/i);
    assertNoForeignHosts(project.cwd);
  });

  test("compile -o nested/OUT.md writes only that path", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd, "p7d-custom-out");

    const outRel = join("nested", "OUT.md");
    const { result, combined } = await runInProject(project.cwd, ["compile", "-o", outRel]);
    expectKnownCommand(combined, "compile");
    expectKnownCompileFlag(combined, "-o");
    expect(result).toBe(0);

    const outAbs = join(project.cwd, outRel);
    expect(existsSync(outAbs)).toBe(true);
    expect(readFileSync(outAbs, "utf8")).toMatch(/Style|concise/i);
    expect(existsSync(agentsPath(project.cwd))).toBe(false);
    assertNoForeignHosts(project.cwd);
  });

  test("compile --output PATH writes chosen file", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd, "p7d-long-out");

    const outRel = join("build", "AGENTS.md");
    const { result, combined } = await runInProject(project.cwd, [
      "compile",
      "--output",
      outRel,
    ]);
    expectKnownCommand(combined, "compile");
    expectKnownCompileFlag(combined, "--output");
    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, outRel))).toBe(true);
    expect(existsSync(agentsPath(project.cwd))).toBe(false);
  });
});
