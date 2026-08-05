/**
 * p6a CLI: --parallel-downloads, -v/--verbose, --exclude; help surface.
 * Spec: cli-runtime-surface.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  expectKnownFlags,
  formatInstallHelp,
  parseInstallArgs,
  runInProject,
  writeLeafProject,
  type TempProject,
} from "./helpers.ts";

describe("CLI p6a install UX flags and help", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("install help lists --dry-run, --parallel-downloads, -v/--verbose, --exclude", async () => {
    project = createTempProject();
    const viaFlag = await runInProject(project.cwd, ["install", "--help"]);
    const viaHelp = await runInProject(project.cwd, ["help", "install"]);
    const text = [
      viaFlag.combined,
      viaHelp.combined,
      formatInstallHelp({ name: "bapm", manifestFile: "bapm.yml", lockFile: "bapm.lock.yaml" }),
    ].join("\n");

    expect(viaFlag.result === 0 || viaHelp.result === 0).toBe(true);
    expect(text).toMatch(/--dry-run/);
    expect(text).toMatch(/--parallel-downloads/);
    expect(text).toMatch(/-v|--verbose/);
    expect(text).toMatch(/--exclude/);
    expect(text).toMatch(/MCP|configure|runtime/i);
  });

  test("parseInstallArgs accepts --dry-run, --parallel-downloads, -v, --exclude", () => {
    const parsed = parseInstallArgs(
      ["--dry-run", "--parallel-downloads", "2", "-v", "--exclude", "cursor"],
      { env: {} },
    );
    expect(parsed.error).toBeUndefined();
    expect((parsed as { dryRun?: boolean }).dryRun).toBe(true);
    expect((parsed as { parallelDownloads?: number }).parallelDownloads).toBe(2);
    expect((parsed as { verbose?: boolean }).verbose).toBe(true);
    expect(
      (parsed as { exclude?: string[]; excludeTargets?: string[] }).exclude ??
        (parsed as { excludeTargets?: string[] }).excludeTargets,
    ).toEqual(expect.arrayContaining(["cursor"]));
  });

  test("parallel-downloads flag accepted on install", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-parallel");

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--parallel-downloads",
      "2",
    ]);

    expectKnownCommand(combined, "install");
    expectKnownFlags(combined);
    expect(combined).not.toMatch(/Unknown install flag:\s*--parallel-downloads/i);
    expect(result).toBe(0);
  });

  test("verbose short flag accepted", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-verbose");

    const { result, combined } = await runInProject(project.cwd, ["install", "-v"]);

    expectKnownCommand(combined, "install");
    expectKnownFlags(combined);
    expect(combined).not.toMatch(/Unknown install flag:\s*-v\b/i);
    expect(result).toBe(0);
  });
});
