/**
 * p7d — CLI compile --dry-run / --validate / validate-first (compile-agents-md).
 * MUST: dry-run preview no write; validate no write + distinct message;
 * both → validate-first; custom -o under validate/dry-run still no write.
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
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("p7d CLI compile dry-run + validate", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("--validate leaves AGENTS.md untouched (unskipped SHOULD)", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd, "p7d-validate");

    const { result, stdout, combined } = await runInProject(project.cwd, [
      "compile",
      "--validate",
    ]);
    expectKnownCommand(combined, "compile");
    expectKnownCompileFlag(combined, "--validate");
    expect(result).toBe(0);
    expect(existsSync(agentsPath(project.cwd))).toBe(false);
    const text = stdout.join("\n");
    expect(text).toMatch(/validate/i);
    expect(text).not.toMatch(/would write/i);
    assertNoForeignHosts(project.cwd);
  });

  test("--validate -o nested/OUT.md does not write that path", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd, "p7d-validate-o");
    const outRel = join("nested", "OUT.md");

    const { result, combined } = await runInProject(project.cwd, [
      "compile",
      "--validate",
      "-o",
      outRel,
    ]);
    expectKnownCommand(combined, "compile");
    expectKnownCompileFlag(combined, "--validate");
    expectKnownCompileFlag(combined, "-o");
    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, outRel))).toBe(false);
    expect(existsSync(agentsPath(project.cwd))).toBe(false);
  });

  test("--dry-run leaves output absent and prints would-write preview", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd, "p7d-dry-run");

    const { result, stdout, combined } = await runInProject(project.cwd, [
      "compile",
      "--dry-run",
    ]);
    expectKnownCommand(combined, "compile");
    expectKnownCompileFlag(combined, "--dry-run");
    expect(result).toBe(0);
    expect(existsSync(agentsPath(project.cwd))).toBe(false);

    const text = stdout.join("\n");
    expect(text).toMatch(/dry-run|would write/i);
    expect(text).toMatch(/AGENTS\.md/);
    expect(text).toMatch(/\d+\s+primitives?/i);
    expect(text).not.toMatch(/compile --validate ok/i);
    assertNoForeignHosts(project.cwd);
  });

  test("--dry-run does not rewrite existing AGENTS.md", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd, "p7d-dry-existing");
    const sentinel = "# sentinel-unchanged-by-dry-run\n";
    writeText(agentsPath(project.cwd), sentinel);

    const { result, combined } = await runInProject(project.cwd, ["compile", "--dry-run"]);
    expectKnownCommand(combined, "compile");
    expectKnownCompileFlag(combined, "--dry-run");
    expect(result).toBe(0);
    expect(readFileSync(agentsPath(project.cwd), "utf8")).toBe(sentinel);
  });

  test("--dry-run -o nested/OUT.md does not write that path", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd, "p7d-dry-o");
    const outRel = join("nested", "OUT.md");

    const { result, stdout, combined } = await runInProject(project.cwd, [
      "compile",
      "--dry-run",
      "-o",
      outRel,
    ]);
    expectKnownCommand(combined, "compile");
    expectKnownCompileFlag(combined, "--dry-run");
    expectKnownCompileFlag(combined, "-o");
    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, outRel))).toBe(false);
    expect(existsSync(agentsPath(project.cwd))).toBe(false);
    expect(stdout.join("\n")).toMatch(/nested[/\\]OUT\.md|OUT\.md/);
  });

  test("--validate --dry-run prefers validate messaging and no write", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd, "p7d-validate-first");

    const { result, stdout, combined } = await runInProject(project.cwd, [
      "compile",
      "--validate",
      "--dry-run",
    ]);
    expectKnownCommand(combined, "compile");
    expectKnownCompileFlag(combined, "--validate");
    expectKnownCompileFlag(combined, "--dry-run");
    expect(result).toBe(0);
    expect(existsSync(agentsPath(project.cwd))).toBe(false);

    const text = stdout.join("\n");
    expect(text).toMatch(/validate/i);
    // Primary success must not be dry-run would-write messaging alone.
    expect(text).not.toMatch(/would write/i);
  });
});
