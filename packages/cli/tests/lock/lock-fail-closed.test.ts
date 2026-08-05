/**
 * Bare lock argv fail-closed (unknown flags / unexpected positionals).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { parseLockArgs } from "../../src/modules/Lock/index.ts";
import {
  createTempProject,
  lockPath,
  runInProject,
  writeLeafProject,
  writeSampleLock,
  readLockBytes,
  type TempProject,
} from "./helpers.ts";

describe("CLI bare lock fail-closed argv", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("parseLockArgs rejects unknown flags and unexpected positionals", () => {
    expect(parseLockArgs(["--not-a-real-flag"]).error).toBe(
      "Unknown lock flag: --not-a-real-flag",
    );
    expect(parseLockArgs(["--global"]).error).toBe("Unknown lock flag: --global");
    expect(parseLockArgs(["-g"]).error).toBe("Unknown lock flag: -g");
    expect(parseLockArgs(["--target", "x"]).error).toBe("Unknown lock flag: --target");
    expect(parseLockArgs(["-t", "x"]).error).toBe("Unknown lock flag: -t");
    expect(parseLockArgs(["some-positional"]).error).toBe(
      "Unexpected lock argument: some-positional",
    );
  });

  test("parseLockArgs still accepts known P6c allowlist", () => {
    const parsed = parseLockArgs([
      "--update",
      "-v",
      "--parallel-downloads=0",
      "--no-policy",
      "-h",
    ]);
    expect(parsed.error).toBeUndefined();
    expect(parsed.updateRefs).toBe(true);
    expect(parsed.verbose).toBe(true);
    expect(parsed.parallelDownloads).toBe(0);
    expect(parsed.noPolicy).toBe(true);
    expect(parsed.help).toBe(true);
  });

  test("unknown bare-lock flag fails with stderr and no lock write", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "lock-unknown-flag");
    expect(lockPath(project.cwd)).toBeUndefined();

    const { result, stderr } = await runInProject(project.cwd, ["lock", "--not-a-real-flag"]);

    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toContain("Unknown lock flag: --not-a-real-flag");
    expect(lockPath(project.cwd)).toBeUndefined();
  });

  test("unexpected positional fails with stderr and no lock write", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "lock-positional");

    const { result, stderr } = await runInProject(project.cwd, ["lock", "some-positional"]);

    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toContain("Unexpected lock argument: some-positional");
    expect(lockPath(project.cwd)).toBeUndefined();
  });

  test("unknown flag leaves existing lockfile byte-identical", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "lock-preserve");
    writeSampleLock(project.cwd);
    const before = readLockBytes(project.cwd);

    const { result } = await runInProject(project.cwd, ["lock", "--not-a-real-flag"]);

    expect(result).not.toBe(0);
    expect(Buffer.compare(readLockBytes(project.cwd), before)).toBe(0);
  });
});
