/**
 * cli-runtime-surface + cli-plugin-init help — plugin registered; help lists plugin/init.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  runInProject,
  withCapturedIo,
  type TempProject,
  runCli,
} from "./helpers.ts";

describe("mp-plugin-init CLI runtime / help surface", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("plugin is not an unknown command (plugin --help → 0)", async () => {
    project = createTempProject();
    const { result, combined } = await runInProject(project.cwd, ["plugin", "--help"]);
    expectKnownCommand(combined, "plugin");
    expect(result).toBe(0);
    expect(combined).toMatch(/\binit\b/i);
  });

  test("plugin -h lists init", async () => {
    project = createTempProject();
    const { result, combined } = await runInProject(project.cwd, ["plugin", "-h"]);
    expectKnownCommand(combined, "plugin");
    expect(result).toBe(0);
    expect(combined).toMatch(/\binit\b/i);
  });

  test("top-level help lists plugin", async () => {
    const { result, stdout } = await withCapturedIo(() => runCli(["help"]));
    expect(result).toBe(0);
    expect(stdout.join("\n")).toMatch(/\bplugin\b/i);
  });

  test("plugin init --help documents --yes / -y and project name", async () => {
    project = createTempProject();
    for (const flag of ["--help", "-h"] as const) {
      const { result, combined } = await runInProject(project.cwd, ["plugin", "init", flag]);
      expectKnownCommand(combined, "plugin");
      expect(result).toBe(0);
      expect(combined).toMatch(/--yes|-y/i);
      expect(combined).toMatch(/PROJECT_NAME|project.?name|\[name\]|<name>/i);
    }
  });

  test("unknown plugin init flag fails closed", async () => {
    project = createTempProject();
    const { result, stderr, combined } = await runInProject(project.cwd, [
      "plugin",
      "init",
      "--not-a-flag",
    ]);
    expectKnownCommand(combined, "plugin");
    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/not-a-flag|unknown.*flag/i);
  });
});
