/**
 * CLI update flags + help (cli-runtime-surface).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  expectKnownUpdateFlag,
  formatUpdateHelp,
  parseUpdateArgs,
  runCli,
  runInProject,
  withCapturedIo,
  writeLeafLock,
  writeLeafProject,
  type TempProject,
} from "./helpers.ts";

describe("CLI update flags + help", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("update help lists -v/--verbose and --parallel-downloads (0 = serial)", async () => {
    const viaFlag = await withCapturedIo(() => runCli(["update", "--help"]));
    const viaHelp = await withCapturedIo(() => runCli(["help", "update"]));
    const text = [
      [...viaFlag.stdout, ...viaFlag.stderr].join("\n"),
      [...viaHelp.stdout, ...viaHelp.stderr].join("\n"),
      formatUpdateHelp({ name: "bapm", manifestFile: "bapm.yml", lockFile: "bapm.lock.yaml" }),
    ].join("\n");

    expect(viaFlag.result === 0 || viaHelp.result === 0).toBe(true);
    expect(text).toMatch(/-v,\s*--verbose|--verbose\b/);
    expect(text).toMatch(/--parallel-downloads/);
    expect(text).toMatch(/0\s*=\s*serial|serial.*\b0\b|default\s+4/i);
  });

  test("parseUpdateArgs accepts -v and --parallel-downloads 0 / = form", () => {
    const short = parseUpdateArgs(["-v", "--parallel-downloads", "0", "--dry-run"]);
    expect(short.error).toBeUndefined();
    expect((short as { verbose?: boolean }).verbose).toBe(true);
    expect((short as { parallelDownloads?: number }).parallelDownloads).toBe(0);
    expect((short as { dryRun?: boolean }).dryRun).toBe(true);

    const long = parseUpdateArgs(["--verbose", "--parallel-downloads=4"]);
    expect(long.error).toBeUndefined();
    expect((long as { verbose?: boolean }).verbose).toBe(true);
    expect((long as { parallelDownloads?: number }).parallelDownloads).toBe(4);
  });

  test("verbose short flag accepted on update dry-run", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-update-v");
    writeLeafLock(project.cwd);

    const { result, combined } = await runInProject(project.cwd, [
      "update",
      "-v",
      "--dry-run",
    ]);
    expectKnownCommand(combined, "update");
    expectKnownUpdateFlag(combined, "-v");
    expect(combined).not.toMatch(/Unknown update flag:\s*-v\b/i);
    expect(result).toBe(0);
  });

  test("parallel-downloads 0 accepted (not unknown; serial)", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-update-pd0");
    writeLeafLock(project.cwd);

    const { result, combined } = await runInProject(project.cwd, [
      "update",
      "--parallel-downloads",
      "0",
      "--dry-run",
    ]);
    expectKnownCommand(combined, "update");
    expectKnownUpdateFlag(combined, "--parallel-downloads");
    expect(combined).not.toMatch(/Unknown update flag:\s*--parallel-downloads/i);
    expect(combined).not.toMatch(/Invalid --parallel-downloads value:\s*0/i);
    expect(result).toBe(0);
  });

  test("invalid parallel-downloads fails closed naming the value", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-update-pd-bad");
    writeLeafLock(project.cwd);

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "update",
      "--parallel-downloads",
      "nope",
    ]);
    expectKnownCommand(combined, "update");
    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/Invalid --parallel-downloads value:\s*nope/i);
  });

  test("unknown update flag still fails closed", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-update-badflag");
    writeLeafLock(project.cwd);

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "update",
      "--not-a-real-flag",
    ]);
    expectKnownCommand(combined, "update");
    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/not-a-real-flag|unknown.*flag/i);
  });
});
