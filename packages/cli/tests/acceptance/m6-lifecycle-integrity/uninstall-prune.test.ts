/**
 * M6 CLI uninstall + prune — flags + exit codes.
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
  writeLeafProject,
  writeLock,
  type TempProject,
} from "./helpers.ts";

describe("M6 CLI uninstall + prune", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("uninstall unknown package → non-zero clear error", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-un-unknown");
    writeLock(
      project.cwd,
      `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n`,
    );

    const { result, combined } = await runInProject(project.cwd, ["uninstall", "no-such-pkg"]);
    expectKnownCommand(combined, "uninstall");
    expect(result).not.toBe(0);
    expect(combined).toMatch(/no-such-pkg|not found|unknown|not installed/i);
  });

  test("uninstall --dry-run leaves manifest and lock unchanged", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-un-dry");
    writeLock(
      project.cwd,
      `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n`,
    );
    const manifestBefore = readFileSync(join(project.cwd, "bapm.yml"));
    const lockBefore = readBytes(existingLockPath(project.cwd)!);

    const { result, combined } = await runInProject(project.cwd, [
      "uninstall",
      "--dry-run",
      "leaf",
    ]);
    expectKnownCommand(combined, "uninstall");
    expect(result).toBe(0);
    expect(Buffer.compare(readFileSync(join(project.cwd, "bapm.yml")), manifestBefore)).toBe(0);
    expect(Buffer.compare(readBytes(existingLockPath(project.cwd)!), lockBefore)).toBe(0);
  });

  test("prune --dry-run reports orphan without deleting", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-prune-dry");
    writeLock(
      project.cwd,
      `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n`,
    );
    const orphan = join(project.cwd, "apm_modules", "orphan-cli");
    mkdirSync(orphan, { recursive: true });
    writeFileSync(join(orphan, "x.txt"), "x\n", "utf8");

    const { result, combined } = await runInProject(project.cwd, ["prune", "--dry-run"]);
    expectKnownCommand(combined, "prune");
    expect(result).toBe(0);
    expect(combined).toMatch(/orphan/i);
    expect(existsSync(join(orphan, "x.txt"))).toBe(true);
  });
});
