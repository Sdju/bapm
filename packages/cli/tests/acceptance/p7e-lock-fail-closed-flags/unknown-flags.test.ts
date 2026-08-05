/**
 * p7e — bare lock unknown flags / positionals fail-closed (lock-command + cli-runtime-surface).
 * MUST: unknown `-…` → non-zero, name flag, no resolve/write; APM `-g/--global/-t/--target` unknown.
 * SHOULD: unexpected positionals; stderr channel; wording `Unknown lock flag: …`.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  expectKnownCommand,
  lockPath,
  parseLockArgs,
  readLockBytes,
  runInProject,
  writeLeafProject,
  writeSampleLock,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("p7e bare lock argv fail-closed", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("unknown bare-lock flag fails without lock write", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p7e-unknown-flag");
    expect(lockPath(project.cwd)).toBeUndefined();

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "lock",
      "--not-a-real-flag",
    ]);

    expectKnownCommand(combined);
    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/Unknown lock flag:\s*--not-a-real-flag/);
    expect(lockPath(project.cwd)).toBeUndefined();
  });

  test("unknown flag leaves pre-existing lockfile byte-identical", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p7e-unknown-preserve");
    writeSampleLock(project.cwd);
    const before = readLockBytes(project.cwd);

    const { result, stderr } = await runInProject(project.cwd, ["lock", "--not-a-real-flag"]);

    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/Unknown lock flag:\s*--not-a-real-flag/);
    expect(Buffer.compare(readLockBytes(project.cwd), before)).toBe(0);
  });

  test("unknown flag error appears on stderr", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p7e-stderr");

    const { result, stderr } = await runInProject(project.cwd, ["lock", "--not-a-real-flag"]);

    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toContain("Unknown lock flag: --not-a-real-flag");
  });

  test("APM-only --global / -g / --target / -t rejected as unknown", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p7e-apm-only");

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
      expect(stderr.join("\n")).toMatch(new RegExp(`Unknown lock flag:\\s*${flag.replace(/-/g, "\\-")}`));
      expect(lockPath(project.cwd)).toBeUndefined();
    }
  });

  test("unexpected bare-lock positional fails without lock write", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p7e-positional");
    expect(lockPath(project.cwd)).toBeUndefined();

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "lock",
      "some-positional",
    ]);

    expectKnownCommand(combined);
    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/Unexpected lock argument:\s*some-positional/);
    expect(lockPath(project.cwd)).toBeUndefined();
  });

  test("parseLockArgs rejects unknown flags and unexpected positionals", () => {
    const unknown = parseLockArgs(["--not-a-real-flag"]);
    expect(unknown.error).toBe("Unknown lock flag: --not-a-real-flag");

    const globalFlag = parseLockArgs(["--global"]);
    expect(globalFlag.error).toBe("Unknown lock flag: --global");

    const shortG = parseLockArgs(["-g"]);
    expect(shortG.error).toBe("Unknown lock flag: -g");

    const target = parseLockArgs(["--target", "x"]);
    expect(target.error).toBe("Unknown lock flag: --target");

    const shortT = parseLockArgs(["-t", "x"]);
    expect(shortT.error).toBe("Unknown lock flag: -t");

    const positional = parseLockArgs(["some-positional"]);
    expect(positional.error).toBe("Unexpected lock argument: some-positional");
  });

  test("bare lock with unknown flag does not deploy into harness dirs", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p7e-harness-unknown");
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
