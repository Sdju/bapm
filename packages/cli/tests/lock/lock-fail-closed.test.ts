/**
 * Bare lock argv fail-closed (unknown flags / unexpected positionals)
 * + known P6c surface regressions and export fail-closed guard.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { formatLockHelp, parseLockArgs } from "../../src/modules/Lock/index.ts";
import {
  createTempProject,
  expectKnownCommand,
  expectKnownLockFlag,
  lockPath,
  readLockBytes,
  runCli,
  runInProject,
  withCapturedIo,
  writeLeafProject,
  writeSampleLock,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("CLI bare lock fail-closed argv", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("parseLockArgs rejects unknown flags and unexpected positionals", () => {
    expect(parseLockArgs(["--not-a-real-flag"]).error).toBe("Unknown lock flag: --not-a-real-flag");
    expect(parseLockArgs(["--global"]).error).toBe("Unknown lock flag: --global");
    expect(parseLockArgs(["-g"]).error).toBe("Unknown lock flag: -g");
    expect(parseLockArgs(["--target", "x"]).error).toBe("Unknown lock flag: --target");
    expect(parseLockArgs(["-t", "x"]).error).toBe("Unknown lock flag: -t");
    expect(parseLockArgs(["some-positional"]).error).toBe(
      "Unexpected lock argument: some-positional",
    );
  });

  test("parseLockArgs still accepts known P6c allowlist and valued forms", () => {
    const update = parseLockArgs(["--update", "-v", "--no-policy"]);
    expect(update.error).toBeUndefined();
    expect(update.updateRefs).toBe(true);
    expect(update.verbose).toBe(true);
    expect(update.noPolicy).toBe(true);

    const parallelSpace = parseLockArgs(["--parallel-downloads", "0"]);
    expect(parallelSpace.error).toBeUndefined();
    expect(parallelSpace.parallelDownloads).toBe(0);

    const parallelEq = parseLockArgs(["--parallel-downloads=3"]);
    expect(parallelEq.error).toBeUndefined();
    expect(parallelEq.parallelDownloads).toBe(3);

    const policySpace = parseLockArgs(["--policy", "/tmp/p.yml"]);
    expect(policySpace.error).toBeUndefined();
    expect(policySpace.policyPath).toBe("/tmp/p.yml");

    const policyEq = parseLockArgs(["--policy=/tmp/q.yml"]);
    expect(policyEq.error).toBeUndefined();
    expect(policyEq.policyPath).toBe("/tmp/q.yml");

    const help = parseLockArgs(["-h"]);
    expect(help.error).toBeUndefined();
    expect(help.help).toBe(true);
  });

  test("unknown bare-lock flag fails with stderr and no lock write", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "lock-unknown-flag");
    expect(lockPath(project.cwd)).toBeUndefined();

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "lock",
      "--not-a-real-flag",
    ]);

    expectKnownCommand(combined);
    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toContain("Unknown lock flag: --not-a-real-flag");
    expect(lockPath(project.cwd)).toBeUndefined();
  });

  test("unexpected positional fails with stderr and no lock write", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "lock-positional");

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "lock",
      "some-positional",
    ]);

    expectKnownCommand(combined);
    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toContain("Unexpected lock argument: some-positional");
    expect(lockPath(project.cwd)).toBeUndefined();
  });

  test("unknown flag leaves existing lockfile byte-identical", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "lock-preserve");
    writeSampleLock(project.cwd);
    const before = readLockBytes(project.cwd);

    const { result, stderr } = await runInProject(project.cwd, ["lock", "--not-a-real-flag"]);

    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/Unknown lock flag:\s*--not-a-real-flag/);
    expect(Buffer.compare(readLockBytes(project.cwd), before)).toBe(0);
  });

  test("APM-only --global / -g / --target / -t rejected as unknown", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "lock-apm-only");

    for (const argv of [
      ["lock", "--global"],
      ["lock", "-g"],
      ["lock", "--target", "cursor"],
      ["lock", "-t", "cursor"],
    ] as const) {
      const flag = argv[1]!;
      const { result, stderr, combined } = await runInProject(project.cwd, [...argv]);
      expectKnownCommand(combined);
      expect(result).not.toBe(0);
      expect(stderr.join("\n")).toMatch(
        new RegExp(`Unknown lock flag:\\s*${flag.replace(/-/g, "\\-")}`),
      );
      expect(lockPath(project.cwd)).toBeUndefined();
    }
  });

  test("bare lock with unknown flag does not deploy into harness dirs", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "lock-harness-unknown");
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeText(join(project.cwd, ".cursor", "keep.txt"), "sentinel\n");
    const keepPath = join(project.cwd, ".cursor", "keep.txt");
    expect(existsSync(keepPath)).toBe(true);

    const { result } = await runInProject(project.cwd, ["lock", "--not-a-real-flag"]);
    expect(result).not.toBe(0);
    expect(existsSync(keepPath)).toBe(true);
    expect(lockPath(project.cwd)).toBeUndefined();
  });
});

describe("CLI lock known surface + export guard", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("known P6c flags are still accepted (not unknown)", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "lock-known-flags");
    const policyPath = join(project.cwd, "bapm-policy.yml");
    writeText(
      policyPath,
      `name: lock-allow
enforcement: warn
dependencies:
  deny: []
`,
    );

    const cases: { argv: string[]; flag: string }[] = [
      { argv: ["lock", "--update"], flag: "--update" },
      { argv: ["lock", "-v"], flag: "-v" },
      { argv: ["lock", "--verbose"], flag: "--verbose" },
      { argv: ["lock", "--parallel-downloads", "0"], flag: "--parallel-downloads" },
      { argv: ["lock", "--parallel-downloads=2"], flag: "--parallel-downloads" },
      { argv: ["lock", "--policy", policyPath], flag: "--policy" },
      { argv: ["lock", `--policy=${policyPath}`], flag: "--policy" },
      { argv: ["lock", "--no-policy"], flag: "--no-policy" },
    ];

    for (const { argv, flag } of cases) {
      const { result, combined } = await runInProject(project.cwd, argv);
      expectKnownCommand(combined);
      expectKnownLockFlag(combined, flag);
      expect(result).toBe(0);
      expect(lockPath(project.cwd)).toBeTruthy();
    }
  });

  test("missing/invalid valued known flags still error", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "lock-valued-errors");

    const missingPolicy = await runInProject(project.cwd, ["lock", "--policy"]);
    expect(missingPolicy.result).not.toBe(0);
    expect(missingPolicy.stderr.join("\n")).toMatch(/Missing value for --policy/i);

    const missingParallel = await runInProject(project.cwd, ["lock", "--parallel-downloads"]);
    expect(missingParallel.result).not.toBe(0);
    expect(missingParallel.stderr.join("\n")).toMatch(/missing value for --parallel-downloads/i);

    const badParallel = await runInProject(project.cwd, [
      "lock",
      "--parallel-downloads=not-a-number",
    ]);
    expect(badParallel.result).not.toBe(0);
    expect(badParallel.stderr.join("\n")).toMatch(/invalid --parallel-downloads value/i);
  });

  test("lock help documents known options only (no --global / --target)", async () => {
    const viaFlag = await withCapturedIo(() => runCli(["lock", "--help"]));
    const viaShort = await withCapturedIo(() => runCli(["lock", "-h"]));
    const viaHelp = await withCapturedIo(() => runCli(["help", "lock"]));
    const text = [
      [...viaFlag.stdout, ...viaFlag.stderr].join("\n"),
      [...viaShort.stdout, ...viaShort.stderr].join("\n"),
      [...viaHelp.stdout, ...viaHelp.stderr].join("\n"),
      formatLockHelp(),
    ].join("\n");

    expect(viaFlag.result).toBe(0);
    expect(viaShort.result).toBe(0);
    expect(text).toMatch(/--update\b/);
    expect(text).toMatch(/--verbose|-v\b/);
    expect(text).toMatch(/--parallel-downloads\b/);
    expect(text).toMatch(/--policy\b/);
    expect(text).toMatch(/--no-policy\b/);
    expect(text).toMatch(/\bexport\b/i);
    expect(text).not.toMatch(/--global\b/);
    expect(text).not.toMatch(/--target\b/);
  });

  test("lock export unknown flag remains fail-closed", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "lock-export-unknown");
    writeSampleLock(project.cwd);

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "lock",
      "export",
      "--not-a-real-flag",
    ]);

    expectKnownCommand(combined);
    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/Unknown lock export flag:\s*--not-a-real-flag/);
  });
});
