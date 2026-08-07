import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../../../src/index.ts";

type Project = { cwd: string; cleanup: () => void };

function createProject(withCursorLayout: boolean): Project {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-cli-target-"));
  if (withCursorLayout) mkdirSync(join(cwd, ".cursor"), { recursive: true });
  mkdirSync(join(cwd, ".apm", "instructions"), { recursive: true });
  writeFileSync(
    join(cwd, "bapm.yml"),
    "name: cli-target\nversion: 0.0.1\ndependencies:\n  apm: []\n",
    "utf8",
  );
  writeFileSync(join(cwd, ".apm", "instructions", "guide.md"), "# Guide\n", "utf8");
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

async function runInProject(cwd: string, argv: string[]) {
  const previous = process.cwd();
  const output: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  process.chdir(cwd);
  console.log = (message?: unknown) => output.push(String(message));
  console.error = (message?: unknown) => output.push(String(message));
  try {
    return { exitCode: await runCli(argv), output: output.join("\n") };
  } finally {
    console.log = originalLog;
    console.error = originalError;
    process.chdir(previous);
  }
}

describe("compile target selection acceptance", () => {
  let project: Project | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("documents --target <id> as the remedy for missing or ambiguous detection", async () => {
    project = createProject(true);

    const { exitCode, output } = await runInProject(project.cwd, ["compile", "--help"]);

    expect(exitCode).toBe(0);
    expect(output).toMatch(/--target\s+<id>/i);
    expect(output).toMatch(/missing|ambiguous|required/i);
  });

  test("requires --target when no registered target detects and leaves no output", async () => {
    project = createProject(false);

    const { exitCode, output } = await runInProject(project.cwd, ["compile"]);

    expect(exitCode).not.toBe(0);
    expect(output).toMatch(/--target\s+<id>/i);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
  });

  test("forwards --target=<id> to the registered Cursor target even without its detection signal", async () => {
    project = createProject(false);

    const { exitCode, output } = await runInProject(project.cwd, ["compile", "--target=cursor"]);

    expect(output).not.toMatch(/unknown (?:flag|option)|unrecognized/i);
    expect(exitCode).toBe(0);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(true);
  });
});
