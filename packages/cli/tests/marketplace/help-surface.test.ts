/**
 * marketplace-cli-authoring — Authoring help section; consumer validate still available;
 * deferred verbs (outdated/audit/build) stay unregistered.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  expectKnownMarketplaceSub,
  runInProject,
  type TempProject,
  withCapturedIo,
  runCli,
} from "./authoring-helpers.ts";

describe("mp-authoring-yml CLI help + consumer boundary", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("marketplace help lists Authoring with init and check", async () => {
    project = createTempProject();
    const { result, combined } = await runInProject(project.cwd, ["marketplace", "--help"]);
    expectKnownCommand(combined, "marketplace");
    expect(result).toBe(0);
    expect(combined).toMatch(/Authoring/i);
    expect(combined).toMatch(/\binit\b/i);
    expect(combined).toMatch(/\bcheck\b/i);
    expect(combined).toMatch(/Consumer/i);
    expect(combined).not.toMatch(/marketplace\.json emit|marketplace build is shipped/i);
  });

  test("marketplace init --help is not unknown subcommand", async () => {
    project = createTempProject();
    const { result, combined } = await runInProject(project.cwd, [
      "marketplace",
      "init",
      "--help",
    ]);
    expectKnownMarketplaceSub(combined, "init");
    expect(result).toBe(0);
  });

  test("outdated / audit / build remain unregistered (fail closed)", async () => {
    project = createTempProject();
    for (const sub of ["outdated", "audit", "build"] as const) {
      const { result, combined } = await runInProject(project.cwd, ["marketplace", sub]);
      expectKnownCommand(combined, "marketplace");
      expect(result).not.toBe(0);
      expect(combined).toMatch(/unknown|invalid|unrecognized|not supported/i);
    }
  });

  test("top-level help still lists marketplace", async () => {
    const { result, stdout } = await withCapturedIo(() => runCli(["help"]));
    expect(result).toBe(0);
    expect(stdout.join("\n")).toMatch(/\bmarketplace\b/i);
  });

  test("consumer validate remains a registered marketplace verb (help mentions it)", async () => {
    project = createTempProject();
    const { result, combined } = await runInProject(project.cwd, ["marketplace", "--help"]);
    expect(result).toBe(0);
    expect(combined).toMatch(/\bvalidate\b/i);
  });
});
