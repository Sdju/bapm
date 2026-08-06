/**
 * cli-find — top-level `bapm find PATH` exits, flags, help.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  FIND_LOCK_YAML,
  runInProject,
  stderrText,
  stdoutText,
  writeFindProject,
  writeLock,
  writeManifest,
  type TempProject,
} from "./helpers.ts";

describe("mp-find CLI find command", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("find returns owners for tracked path (exit 0)", async () => {
    project = createTempProject();
    writeFindProject(project.cwd);

    const { result, stdout, combined } = await runInProject(project.cwd, ["find", "AGENTS.md"]);
    expectKnownCommand(combined, "find");
    expect(result).toBe(0);
    expect(stdoutText(stdout)).toMatch(/https:\/\/example\.com\/org\/alpha\.git|org\/alpha/);
  });

  test("unknown path exits 1", async () => {
    project = createTempProject();
    writeFindProject(project.cwd);

    const { result, combined } = await runInProject(project.cwd, ["find", "not-tracked.txt"]);
    expectKnownCommand(combined, "find");
    expect(result).toBe(1);
  });

  test("missing lock exits 2 and mentions bapm.lock.yaml", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "mp-find-nolock");

    const { result, stderr, combined } = await runInProject(project.cwd, ["find", "anything"]);
    expectKnownCommand(combined, "find");
    expect(result).toBe(2);
    expect(stderrText(stderr)).toMatch(/bapm\.lock\.yaml/i);
  });

  test("--source appends origin detail", async () => {
    project = createTempProject();
    writeFindProject(project.cwd);

    const { result, stdout, combined } = await runInProject(project.cwd, [
      "find",
      "AGENTS.md",
      "--source",
    ]);
    expectKnownCommand(combined, "find");
    expect(result).toBe(0);
    const text = stdoutText(stdout);
    expect(text).toMatch(/https:\/\/example\.com\/org\/alpha\.git|org\/alpha/);
    // Origin beyond bare label (ref / tag / commit fragment)
    expect(text).toMatch(/@main|@v1\.0\.0|@[0-9a-f]{7,12}|\(workspace\)/i);
  });

  test("--path prints why detail for non-workspace owner", async () => {
    project = createTempProject();
    writeFindProject(project.cwd);

    const { result, stdout, combined } = await runInProject(project.cwd, [
      "find",
      "AGENTS.md",
      "--path",
    ]);
    expectKnownCommand(combined, "find");
    expect(result).toBe(0);
    const text = stdoutText(stdout);
    expect(text).toMatch(/https:\/\/example\.com\/org\/alpha\.git|org\/alpha/);
    expect(text).toMatch(/\n\s+\S+|→|->/);
    expect(text).not.toMatch(/\bapm\.yml\b/);
  });

  test("unknown find flag fails closed", async () => {
    project = createTempProject();
    writeFindProject(project.cwd);

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "find",
      "AGENTS.md",
      "--not-a-flag",
    ]);
    expectKnownCommand(combined, "find");
    expect(result).not.toBe(0);
    expect(stderrText(stderr)).toMatch(/not-a-flag|unknown.*flag/i);
  });

  test("find help documents PATH, --source, --path", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "mp-find-help");
    writeLock(project.cwd, FIND_LOCK_YAML);

    for (const flag of ["--help", "-h"] as const) {
      const { result, combined } = await runInProject(project.cwd, ["find", flag]);
      expectKnownCommand(combined, "find");
      expect(result).toBe(0);
      expect(combined).toMatch(/PATH|path/i);
      expect(combined).toMatch(/--source/);
      expect(combined).toMatch(/--path/);
    }
  });
});
