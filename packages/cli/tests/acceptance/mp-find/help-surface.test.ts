/**
 * cli-runtime-surface — find registered; help lists find.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  runInProject,
  withCapturedIo,
  type TempProject,
} from "./helpers.ts";
import { runCli } from "../../../src/index.ts";

describe("mp-find CLI runtime surface", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("find is not an unknown command (find --help → 0)", async () => {
    project = createTempProject();
    const { result, combined } = await runInProject(project.cwd, ["find", "--help"]);
    expectKnownCommand(combined, "find");
    expect(result).toBe(0);
  });

  test("top-level help lists find", async () => {
    const { result, stdout } = await withCapturedIo(() => runCli(["help"]));
    expect(result).toBe(0);
    expect(stdout.join("\n")).toMatch(/\bfind\b/i);
  });

  test("find is top-level, not nested under marketplace", async () => {
    project = createTempProject();
    // marketplace find remains rejected (authoring OOS); top-level find is the consumer path
    const nested = await runInProject(project.cwd, ["marketplace", "find", "x"]);
    expect(nested.result).not.toBe(0);

    const top = await runInProject(project.cwd, ["find", "--help"]);
    expectKnownCommand(top.combined, "find");
    expect(top.result).toBe(0);
  });
});
