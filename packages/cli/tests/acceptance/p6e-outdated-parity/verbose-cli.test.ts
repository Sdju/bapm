/**
 * P6e CLI — -v / --verbose, unknown flags, help surface.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  expectKnownCommand,
  existingLockPath,
  readBytes,
  runInProject,
  writeEmptyDepsProject,
  writeLeafProject,
  writeLock,
  type TempProject,
} from "../../lifecycle/helpers.ts";

describe("p6e acceptance — CLI outdated verbose surface", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("-v is recognized (not unknown) and exits per lifecycle rules", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6e-cli-v");
    writeLock(
      project.cwd,
      `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n`,
    );

    const { result, combined } = await runInProject(project.cwd, ["outdated", "-v"]);
    expectKnownCommand(combined, "outdated");
    expect(combined).not.toMatch(/unknown outdated flag.*-v|unknown flag.*-v/i);
    expect(result).toBe(0);
  });

  test("--verbose is recognized", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6e-cli-verbose");
    writeLock(
      project.cwd,
      `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n`,
    );

    const { result, combined } = await runInProject(project.cwd, ["outdated", "--verbose"]);
    expectKnownCommand(combined, "outdated");
    expect(combined).not.toMatch(/unknown outdated flag|unknown flag/i);
    expect(result).toBe(0);
  });

  test("unknown outdated flag still fails", async () => {
    project = createTempProject();
    writeEmptyDepsProject(project.cwd, "p6e-cli-badflag");
    writeLock(project.cwd, `lockfile_version: "1"\ndependencies: []\n`);

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "outdated",
      "--not-a-real-flag",
    ]);
    expectKnownCommand(combined, "outdated");
    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/not-a-real-flag|unknown.*flag/i);
  });

  test("help mentions verbose and report-only vs update", async () => {
    project = createTempProject();
    writeEmptyDepsProject(project.cwd, "p6e-cli-help");

    const { result, stdout, combined } = await runInProject(project.cwd, ["outdated", "--help"]);
    expectKnownCommand(combined, "outdated");
    expect(result).toBe(0);
    const text = stdout.join("\n");
    expect(text).toMatch(/-v|--verbose/i);
    expect(text).toMatch(/report-only|does not (?:modify|write|change)|read-only|update/i);
  });

  test("verbose run does not rewrite lock bytes", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6e-cli-ro-v");
    writeLock(
      project.cwd,
      `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n`,
    );
    mkdirSync(join(project.cwd, "apm_modules"), { recursive: true });
    writeFileSync(join(project.cwd, "apm_modules", ".keep"), "keep\n", "utf8");
    const lockPath = existingLockPath(project.cwd)!;
    const beforeLock = readBytes(lockPath);
    const beforeKeep = readFileSync(join(project.cwd, "apm_modules", ".keep"));

    const { result, combined } = await runInProject(project.cwd, ["outdated", "-v"]);
    expectKnownCommand(combined, "outdated");
    expect(result).toBe(0);
    expect(Buffer.compare(readBytes(lockPath), beforeLock)).toBe(0);
    expect(existsSync(join(project.cwd, "apm_modules", ".keep"))).toBe(true);
    expect(Buffer.compare(readFileSync(join(project.cwd, "apm_modules", ".keep")), beforeKeep)).toBe(
      0,
    );
  });
});
