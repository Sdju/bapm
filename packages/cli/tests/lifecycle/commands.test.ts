/**
 * CLI surface — help lists lifecycle commands; unknown flags hard-error (C §24–25).
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  runCli,
  runInProject,
  withCapturedIo,
  writeEmptyDepsProject,
  writeLeafProject,
  writeLock,
  type TempProject,
} from "./helpers.ts";

const LIFECYCLE_COMMANDS = [
  "update",
  "outdated",
  "uninstall",
  "prune",
  "deps",
  "audit",
  "doctor",
] as const;

describe("CLI wiring / help / flags", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("§24 help lists update, outdated, uninstall, prune, deps, audit, doctor (not stubs)", async () => {
    const { result, stdout } = await withCapturedIo(() => runCli(["help"]));
    const text = stdout.join("\n");
    expect(result).toBe(0);
    for (const cmd of LIFECYCLE_COMMANDS) {
      expect(text).toMatch(new RegExp(`\\b${cmd}\\b`, "i"));
    }
    expect(text).not.toMatch(/update\s*\(stub\)|outdated\s*\(stub\)|not implemented/i);
  });

  test("§25 unknown flag on lifecycle command hard-errors", async () => {
    project = createTempProject();
    writeEmptyDepsProject(project.cwd, "flag-err");
    writeLock(project.cwd, `lockfile_version: "1"\ndependencies: []\n`);

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "outdated",
      "--not-a-real-flag",
    ]);
    expectKnownCommand(combined, "outdated");
    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/not-a-real-flag|unknown.*flag/i);
  });

  test("update is a registered command (not unknown)", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "upd-known");
    const { combined } = await runInProject(project.cwd, ["update", "--dry-run"]);
    expectKnownCommand(combined, "update");
  });

  test("deps list is a registered command path", async () => {
    project = createTempProject();
    writeEmptyDepsProject(project.cwd, "deps-known");
    writeLock(project.cwd, `lockfile_version: "1"\ndependencies: []\n`);
    const { combined } = await runInProject(project.cwd, ["deps", "list"]);
    expectKnownCommand(combined, "deps list");
  });

  test("audit --ci is a registered command", async () => {
    project = createTempProject();
    writeEmptyDepsProject(project.cwd, "audit-known");
    const { combined } = await runInProject(project.cwd, ["audit", "--ci"]);
    expectKnownCommand(combined, "audit");
  });
});
