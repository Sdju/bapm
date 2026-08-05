/**
 * CLI update plan verbosity: hide keep unless -v (lifecycle-update).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  existingLockPath,
  expectKnownCommand,
  expectKnownUpdateFlag,
  honestEmptyChangePattern,
  keepPlanPattern,
  readBytes,
  runInProject,
  writeLeafLock,
  writeLeafProject,
  type TempProject,
} from "./helpers.ts";

describe("CLI update plan verbosity (keep gate)", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("dry-run without -v hides keep/[=] rows (all-keep stays honest)", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-update-quiet");
    writeLeafLock(project.cwd);
    const lockPath = existingLockPath(project.cwd)!;
    const before = readBytes(lockPath);

    const { result, stdout, combined } = await runInProject(project.cwd, [
      "update",
      "--dry-run",
    ]);
    expectKnownCommand(combined, "update");
    expect(result).toBe(0);
    expect(Buffer.compare(readBytes(lockPath), before)).toBe(0);

    const out = stdout.join("\n");
    expect(out).not.toMatch(keepPlanPattern());
    expect(combined).toMatch(honestEmptyChangePattern());
  });

  test("dry-run with -v prints keep/[=] rows", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-update-verbose-plan");
    writeLeafLock(project.cwd);
    const lockPath = existingLockPath(project.cwd)!;
    const before = readBytes(lockPath);

    const { result, stdout, combined } = await runInProject(project.cwd, [
      "update",
      "--dry-run",
      "-v",
    ]);
    expectKnownCommand(combined, "update");
    expectKnownUpdateFlag(combined, "-v");
    expect(result).toBe(0);
    expect(Buffer.compare(readBytes(lockPath), before)).toBe(0);
    expect(stdout.join("\n")).toMatch(keepPlanPattern());
  });
});
