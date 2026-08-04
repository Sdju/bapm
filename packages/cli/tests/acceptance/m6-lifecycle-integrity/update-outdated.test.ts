/**
 * M6 CLI update / outdated — thin flags + exit codes.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  existingLockPath,
  readBytes,
  runInProject,
  writeLeafProject,
  writeLock,
  writeEmptyDepsProject,
  type TempProject,
} from "./helpers.ts";

describe("M6 CLI update + outdated", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("update --dry-run does not rewrite lock bytes", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-update-dry");
    // Seed via lock command path may be heavy; write a minimal lock matching leaf
    writeLock(
      project.cwd,
      `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n`,
    );
    const lockPath = existingLockPath(project.cwd)!;
    const before = readBytes(lockPath);

    const { result, combined } = await runInProject(project.cwd, ["update", "--dry-run"]);
    expectKnownCommand(combined, "update");
    expect(result).toBe(0);
    expect(Buffer.compare(readBytes(lockPath), before)).toBe(0);
  });

  test("update -y applies without interactive prompt (exit 0 on path project)", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-update-yes");
    writeLock(
      project.cwd,
      `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n`,
    );

    const { result, combined } = await runInProject(project.cwd, ["update", "-y"]);
    expectKnownCommand(combined, "update");
    expect(combined).not.toMatch(/Apply\?/i);
    expect(result).toBe(0);
  });

  test("outdated without lock → non-zero", async () => {
    project = createTempProject();
    writeEmptyDepsProject(project.cwd, "cli-outdated-nolock");

    const { result, combined } = await runInProject(project.cwd, ["outdated"]);
    expectKnownCommand(combined, "outdated");
    expect(result).not.toBe(0);
    expect(combined).toMatch(/lock/i);
  });

  test("outdated with matching lock exits 0", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-outdated-ok");
    writeLock(
      project.cwd,
      `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n`,
    );

    const { result, combined } = await runInProject(project.cwd, ["outdated"]);
    expectKnownCommand(combined, "outdated");
    expect(result).toBe(0);
  });
});
