/**
 * producer-pack-archive + marketplace-cli-authoring — help surfaces for pack marketplace emit.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  runInProject,
  type TempProject,
  withCapturedIo,
  runCli,
} from "./pack-outputs-helpers.ts";

describe("mp-pack-outputs CLI help surface", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("pack --help mentions marketplace emit flags", async () => {
    project = createTempProject();
    const { result, combined } = await runInProject(project.cwd, ["pack", "--help"]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(0);
    expect(combined).toMatch(/--marketplace\b/i);
    expect(combined).toMatch(/marketplace/i);
  });

  test("unknown pack flag still fails closed", async () => {
    project = createTempProject();
    const { result, stderr, combined } = await runInProject(project.cwd, [
      "pack",
      "--not-a-real-flag",
    ]);
    expectKnownCommand(combined, "pack");
    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/not-a-real-flag|unknown.*flag/i);
  });

  test("Authoring help does not claim pack host outputs are not shipped", async () => {
    project = createTempProject();
    const { result, combined } = await runInProject(project.cwd, ["marketplace", "--help"]);
    expectKnownCommand(combined, "marketplace");
    expect(result).toBe(0);
    expect(combined).not.toMatch(/pack host outputs.*not shipped|Not shipped.*pack host outputs/i);
    expect(combined).not.toMatch(/\bmarketplace build\b/i);
  });

  test("top-level help still lists pack", async () => {
    const { result, stdout } = await withCapturedIo(() => runCli(["help"]));
    expect(result).toBe(0);
    expect(stdout.join("\n")).toMatch(/\bpack\b/i);
  });
});
