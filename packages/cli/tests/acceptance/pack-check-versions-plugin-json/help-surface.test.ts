/**
 * producer-pack-archive + producer-pack-check-versions — pack help / parse surface.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  checkVersionsOf,
  createTempProject,
  expectKnownCommand,
  formatPackHelp,
  parsePackArgs,
  runInProject,
  withCapturedIo,
  runCli,
  type TempProject,
} from "./helpers.ts";

describe("pack-check-versions-plugin-json — CLI help / parse", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("pack --help mentions --check-versions and --check-release distinctly", async () => {
    project = createTempProject();
    const viaFlag = await runInProject(project.cwd, ["pack", "--help"]);
    const viaHelp = await runInProject(project.cwd, ["help", "pack"]);
    const formatted = formatPackHelp({
      name: "bapm",
      runPack: async () => ({}),
      checkReleaseTag: async () => ({}),
    });
    const text = [viaFlag.combined, viaHelp.combined, formatted].join("\n");

    expect(viaFlag.result === 0 || viaHelp.result === 0).toBe(true);
    expect(text).toMatch(/--check-versions/);
    expect(text).toMatch(/--check-release/);
    expect(text).toMatch(/marketplace|version.?align|lockstep|plugin\.json/i);
    // Must not collapse the two gates into one flag.
    expect(text).not.toMatch(
      /--check-versions\s*=\s*--check-release|--check-release.*alias.*--check-versions/i,
    );
  });

  test("parsePackArgs accepts --check-versions without aliasing to --check-release", () => {
    const parsed = parsePackArgs(["--check-versions"]) as Record<string, unknown>;
    expect(parsed.error).toBeUndefined();
    expect(checkVersionsOf(parsed)).toBe(true);
    expect(parsed.checkRelease).toBeFalsy();
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

  test("top-level help still lists pack", async () => {
    const { result, stdout } = await withCapturedIo(() => runCli(["help"]));
    expect(result).toBe(0);
    expect(stdout.join("\n")).toMatch(/\bpack\b/i);
  });
});
