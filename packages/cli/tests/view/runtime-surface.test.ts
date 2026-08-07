/**
 * CLI runtime surface: `view` registered; top-level help lists view
 * (promoted from cli-view-local-package acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  runCli,
  runInProject,
  withCapturedIo,
  type TempProject,
} from "./helpers.ts";

describe("CLI view runtime surface", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("view is not an unknown command (view --help → 0)", async () => {
    project = createTempProject();
    const { result, combined } = await runInProject(project.cwd, ["view", "--help"]);
    expectKnownCommand(combined, "view");
    expect(result).toBe(0);
  });

  test("top-level help lists view", async () => {
    const { result, stdout } = await withCapturedIo(() => runCli(["help"]));
    expect(result).toBe(0);
    expect(stdout.join("\n")).toMatch(/\bview\b/i);
  });
});
