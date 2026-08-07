/**
 * Acceptance (RED): cli-view — top-level `bapm view <package>`.
 * OpenSpec change: cli-view-local-package
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  runInProject,
  stderrText,
  stdoutText,
  writeInstalledSharedUtilsTree,
  writeManifest,
  writeViewOkLock,
  type TempProject,
} from "./helpers.ts";

describe("cli-view-local-package CLI view command", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("view prints local metadata for installed package (exit 0)", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "view-cli-ok");
    writeViewOkLock(project.cwd);
    writeInstalledSharedUtilsTree(project.cwd, "Shared helpers for agents");

    const { result, stdout, combined } = await runInProject(project.cwd, [
      "view",
      "acme/shared-utils",
    ]);
    expectKnownCommand(combined, "view");
    expect(result).toBe(0);
    const text = stdoutText(stdout);
    expect(text).toMatch(/acme\/shared-utils|shared-utils/i);
    expect(text).toMatch(/2\.1\.0|v2\.1\.0/);
  });

  test("view missing package exits 1", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "view-cli-missing");
    writeViewOkLock(project.cwd);

    const { result, combined } = await runInProject(project.cwd, ["view", "missing-pkg"]);
    expectKnownCommand(combined, "view");
    expect(result).toBe(1);
  });

  test("view missing lock exits 2", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "view-cli-nolock");

    const { result, combined } = await runInProject(project.cwd, ["view", "anything"]);
    expectKnownCommand(combined, "view");
    expect(result).toBe(2);
  });

  test("view without package argument fails", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "view-cli-noarg");
    writeViewOkLock(project.cwd);

    const { result, combined } = await runInProject(project.cwd, ["view"]);
    expectKnownCommand(combined, "view");
    expect(result).not.toBe(0);
  });

  test("unknown view flag fails closed", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "view-cli-badflag");
    writeViewOkLock(project.cwd);

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "view",
      "acme/shared-utils",
      "--not-a-flag",
    ]);
    expectKnownCommand(combined, "view");
    expect(result).not.toBe(0);
    expect(stderrText(stderr)).toMatch(/not-a-flag|unknown.*flag/i);
  });

  test("view rejects versions field (out of scope)", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "view-cli-versions");
    writeViewOkLock(project.cwd);

    const { result, combined } = await runInProject(project.cwd, [
      "view",
      "acme/shared-utils",
      "versions",
    ]);
    expectKnownCommand(combined, "view");
    expect(result).not.toBe(0);
  });

  test("view --help / -h document local inspect", async () => {
    project = createTempProject();

    for (const argv of [["view", "--help"], ["view", "-h"]] as const) {
      const { result, stdout, combined } = await runInProject(project.cwd, [...argv]);
      expectKnownCommand(combined, "view");
      expect(result).toBe(0);
      const text = stdoutText(stdout);
      expect(text).toMatch(/package|query|<package>/i);
      expect(text).toMatch(/local|offline/i);
    }
  });
});
