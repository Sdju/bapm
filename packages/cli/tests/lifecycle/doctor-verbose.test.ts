/**
 * CLI doctor -v/--verbose accepted; richer domain detail; help documents verbose;
 * SHOULD thin network (verbose) + auth-env informational.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  expectKnownDoctorFlag,
  formatDoctorHelp,
  lineForCheck,
  MARKETPLACE_ROW_PATTERN,
  parseDoctorArgs,
  projectFingerprintAll,
  runCli,
  runInProject,
  stdoutText,
  withCapturedIo,
  writeDoctorProject,
  type TempProject,
} from "./helpers.ts";

describe("CLI doctor verbose + help", () => {
  let project: TempProject | undefined;
  const prevGithub = process.env.GITHUB_TOKEN;
  const prevGh = process.env.GH_TOKEN;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
    if (prevGithub === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = prevGithub;
    if (prevGh === undefined) delete process.env.GH_TOKEN;
    else process.env.GH_TOKEN = prevGh;
  });

  test("parseDoctorArgs accepts -v / --verbose", () => {
    const short = parseDoctorArgs(["-v"]);
    expect(short.error).toBeUndefined();
    expect(short.verbose).toBe(true);

    const long = parseDoctorArgs(["--verbose"]);
    expect(long.error).toBeUndefined();
    expect(long.verbose).toBe(true);

    const help = parseDoctorArgs(["-h"]);
    expect(help.error).toBeUndefined();
    expect(help.help).toBe(true);
  });

  test("doctor -v accepted with richer domain detail than default", async () => {
    project = createTempProject();
    writeDoctorProject(project.cwd, "p7f-verbose-short");
    const before = projectFingerprintAll(project.cwd);

    const def = await runInProject(project.cwd, ["doctor"]);
    expect(def.result).toBe(0);
    const defaultText = stdoutText(def.stdout);

    const { result, stdout, combined } = await runInProject(project.cwd, ["doctor", "-v"]);
    expectKnownCommand(combined, "doctor");
    expectKnownDoctorFlag(combined, "-v");
    expect(result).toBe(0);
    expect(projectFingerprintAll(project.cwd)).toBe(before);

    const text = stdoutText(stdout);
    expect(text).not.toMatch(MARKETPLACE_ROW_PATTERN);

    const gitLine = lineForCheck(text, "git");
    expect(gitLine).toBeTruthy();
    expect(gitLine!).toMatch(/git version|\d+\.\d+/i);

    const manifestLine = lineForCheck(text, "manifest");
    expect(manifestLine).toBeTruthy();
    expect(manifestLine!).toMatch(/bapm\.yml|apm\.yml/i);
    expect(manifestLine!).toMatch(/p7f-verbose-short/);
    expect(manifestLine!).toMatch(/1\.2\.3/);

    const lockLine = lineForCheck(text, "lockfile");
    expect(lockLine).toBeTruthy();
    expect(lockLine!).toMatch(/bapm\.lock\.yaml|apm\.lock\.yaml/i);
    expect(lockLine!).toMatch(/lockfile_version|dependencies|\b1\b/i);

    const modulesLine = lineForCheck(text, "modules");
    expect(modulesLine).toBeTruthy();
    expect(modulesLine!).toMatch(/apm_modules/i);
    expect(modulesLine!).toMatch(/absent|exist|entr/i);

    // At least one domain message must be strictly richer than default compact text.
    const richer = (["git", "manifest", "lockfile", "modules"] as const).some((name) => {
      const v = lineForCheck(text, name)?.split("\t")[2] ?? "";
      const d = lineForCheck(defaultText, name)?.split("\t")[2] ?? "";
      return v.length > d.length && v !== d;
    });
    expect(richer).toBe(true);
  });

  test("doctor --verbose accepted (long form)", async () => {
    project = createTempProject();
    writeDoctorProject(project.cwd, "p7f-verbose-long");

    const { result, stdout, combined } = await runInProject(project.cwd, ["doctor", "--verbose"]);
    expectKnownCommand(combined, "doctor");
    expectKnownDoctorFlag(combined, "--verbose");
    expect(result).toBe(0);

    const text = stdoutText(stdout);
    expect(lineForCheck(text, "git")).toMatch(/git version|\d+\.\d+/i);
    expect(lineForCheck(text, "manifest")).toMatch(/p7f-verbose-long|1\.2\.3|bapm\.yml/i);
  });

  test("doctor help documents -v / --verbose", async () => {
    const viaFlag = await withCapturedIo(() => runCli(["doctor", "--help"]));
    const viaShort = await withCapturedIo(() => runCli(["doctor", "-h"]));
    const texts = [
      [...viaFlag.stdout, ...viaFlag.stderr].join("\n"),
      [...viaShort.stdout, ...viaShort.stderr].join("\n"),
      formatDoctorHelp({ name: "bapm", manifestFile: "bapm.yml", lockFile: "bapm.lock.yaml" }),
    ];

    expect(viaFlag.result).toBe(0);
    expect(viaShort.result).toBe(0);
    for (const text of texts) {
      expect(text).toMatch(/-v/);
      expect(text).toMatch(/--verbose/);
    }
  });

  test("verbose ships thin network row without critical-failing exit", async () => {
    project = createTempProject();
    writeDoctorProject(project.cwd, "p7f-network");

    const { result, stdout, combined } = await runInProject(project.cwd, ["doctor", "-v"]);
    expectKnownCommand(combined, "doctor");
    expectKnownDoctorFlag(combined, "-v");
    expect(result).toBe(0);

    const text = stdoutText(stdout);
    const networkLine = lineForCheck(text, "network");
    expect(networkLine, `expected informational network row:\n${text}`).toBeTruthy();
    // Network may PASS or FAIL/skip, but must not flip exit when critical domains ok.
    expect(networkLine!).toMatch(/^(PASS|FAIL)\tnetwork\t/);
  });

  test("auth-env informational never fails exit alone and never prints secrets", async () => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;

    project = createTempProject();
    writeDoctorProject(project.cwd, "p7f-auth");

    const { result, stdout, combined } = await runInProject(project.cwd, ["doctor"]);
    expectKnownCommand(combined, "doctor");
    expect(result).toBe(0);

    const text = stdoutText(stdout);
    const authLine = lineForCheck(text, "auth") ?? lineForCheck(text, "auth-env");
    expect(authLine, `expected informational auth/auth-env row:\n${text}`).toBeTruthy();
    expect(authLine!).toMatch(/^PASS\t/);
    expect(text).not.toMatch(/ghp_|github_pat_|gho_|ghu_/i);
    // Presence-by-name only — no raw values even if later set.
    process.env.GITHUB_TOKEN = "ghp_this_must_never_appear_in_output_xyz";
    const withToken = await runInProject(project.cwd, ["doctor"]);
    expect(withToken.result).toBe(0);
    expect(stdoutText(withToken.stdout)).not.toContain("ghp_this_must_never_appear_in_output_xyz");
  });
});
