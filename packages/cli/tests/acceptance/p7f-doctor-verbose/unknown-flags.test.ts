/**
 * p7f — unknown doctor flags remain fail-closed (cli-runtime-surface).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  parseDoctorArgs,
  projectFingerprint,
  runInProject,
  writeDoctorProject,
  type TempProject,
} from "./helpers.ts";

describe("p7f CLI doctor unknown flags fail-closed", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("doctor --not-a-flag hard-errors naming the token", async () => {
    project = createTempProject();
    writeDoctorProject(project.cwd, "p7f-unknown");
    const before = projectFingerprint(project.cwd);

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "doctor",
      "--not-a-flag",
    ]);

    expectKnownCommand(combined);
    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/Unknown doctor flag:\s*--not-a-flag/);
    expect(projectFingerprint(project.cwd)).toBe(before);
  });

  test("doctor --global remains unknown (no multi-target doctor)", async () => {
    project = createTempProject();
    writeDoctorProject(project.cwd, "p7f-global");

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "doctor",
      "--global",
    ]);
    expectKnownCommand(combined);
    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/Unknown doctor flag:\s*--global/);
  });

  test("parseDoctorArgs still rejects unknown flags", () => {
    expect(parseDoctorArgs(["--not-a-flag"]).error).toBe(
      "Unknown doctor flag: --not-a-flag",
    );
    expect(parseDoctorArgs(["--global"]).error).toBe("Unknown doctor flag: --global");
    // Verbose must be allowlisted (RED until parse accepts it).
    expect(parseDoctorArgs(["-v"]).error).toBeUndefined();
    expect(parseDoctorArgs(["--verbose"]).error).toBeUndefined();
  });
});
