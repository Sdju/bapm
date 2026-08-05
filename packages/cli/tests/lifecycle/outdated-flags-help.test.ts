/**
 * CLI outdated -j/--parallel-checks + help + fail-closed (cli-runtime-surface).
 * MUST: parse forms, default 4, 0=serial, invalid fail-closed, help, -j ≠ JSON.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  expectKnownOutdatedFlag,
  formatOutdatedHelp,
  parseOutdatedArgs,
  runCli,
  runInProject,
  withCapturedIo,
  writeEmptyDepsProject,
  writeLeafLock,
  writeLeafProject,
  type TempProject,
} from "./helpers.ts";

describe("CLI outdated parallel-checks + help", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("outdated help lists -j/--parallel-checks (default 4, 0=serial) and --json", async () => {
    const viaFlag = await withCapturedIo(() => runCli(["outdated", "--help"]));
    const viaHelp = await withCapturedIo(() => runCli(["help", "outdated"]));
    const text = [
      [...viaFlag.stdout, ...viaFlag.stderr].join("\n"),
      [...viaHelp.stdout, ...viaHelp.stderr].join("\n"),
      formatOutdatedHelp({ name: "bapm", manifestFile: "bapm.yml", lockFile: "bapm.lock.yaml" }),
    ].join("\n");

    expect(viaFlag.result === 0 || viaHelp.result === 0).toBe(true);
    expect(text).toMatch(/-j\b/);
    expect(text).toMatch(/--parallel-checks\b/);
    expect(text).toMatch(/default\s+4|default:\s*4|\(default\s+4\)/i);
    expect(text).toMatch(/0\s*=\s*serial|serial.*\b0\b/i);
    expect(text).toMatch(/--json\b/);
    expect(text).toMatch(/report-only|does not (?:modify|write|change)|read-only|update/i);
    // Truthful: do not claim APM has outdated --json.
    expect(text).not.toMatch(/APM\s+(?:has|supports|provides)\s+outdated\s+--json/i);
  });

  test("parseOutdatedArgs accepts -j / --parallel-checks space and = forms; omit → default 4", () => {
    const omitted = parseOutdatedArgs([]);
    expect(omitted.error).toBeUndefined();
    expect((omitted as { parallelChecks?: number }).parallelChecks).toBe(4);

    const short = parseOutdatedArgs(["-j", "2"]);
    expect(short.error).toBeUndefined();
    expect((short as { parallelChecks?: number }).parallelChecks).toBe(2);

    const shortEq = parseOutdatedArgs(["-j=8"]);
    expect(shortEq.error).toBeUndefined();
    expect((shortEq as { parallelChecks?: number }).parallelChecks).toBe(8);

    const long = parseOutdatedArgs(["--parallel-checks", "0"]);
    expect(long.error).toBeUndefined();
    expect((long as { parallelChecks?: number }).parallelChecks).toBe(0);

    const longEq = parseOutdatedArgs(["--parallel-checks=3", "-v"]);
    expect(longEq.error).toBeUndefined();
    expect((longEq as { parallelChecks?: number }).parallelChecks).toBe(3);
    expect((longEq as { verbose?: boolean }).verbose).toBe(true);
  });

  test("parseOutdatedArgs accepts --json (long-only) with -j / -v", () => {
    const parsed = parseOutdatedArgs(["--json", "-j", "4", "-v"]);
    expect(parsed.error).toBeUndefined();
    expect((parsed as { json?: boolean }).json).toBe(true);
    expect((parsed as { parallelChecks?: number }).parallelChecks).toBe(4);
    expect((parsed as { verbose?: boolean }).verbose).toBe(true);
  });

  test("-j and --parallel-checks are recognized (not unknown)", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p7b-cli-j");
    writeLeafLock(project.cwd);

    for (const argv of [
      ["outdated", "-j", "2"],
      ["outdated", "-j=2"],
      ["outdated", "--parallel-checks", "8"],
      ["outdated", "--parallel-checks=8"],
    ] as const) {
      const { result, combined } = await runInProject(project.cwd, [...argv]);
      expectKnownCommand(combined, "outdated");
      expectKnownOutdatedFlag(combined, argv[1]!);
      expect(combined).not.toMatch(/unknown outdated flag/i);
      expect(result).toBe(0);
    }
  });

  test("parallel-checks 0 accepted as serial (not invalid)", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p7b-cli-j0");
    writeLeafLock(project.cwd);

    const { result, combined } = await runInProject(project.cwd, ["outdated", "-j", "0"]);
    expectKnownCommand(combined, "outdated");
    expectKnownOutdatedFlag(combined, "-j");
    expect(combined).not.toMatch(/invalid.*(?:parallel-checks|-j).*:\s*0/i);
    expect(result).toBe(0);
  });

  test("invalid / missing parallel-checks fails closed", async () => {
    project = createTempProject();
    writeEmptyDepsProject(project.cwd, "p7b-cli-j-bad");
    writeLeafLock(project.cwd);

    const badValue = await runInProject(project.cwd, ["outdated", "--parallel-checks", "nope"]);
    expectKnownCommand(badValue.combined, "outdated");
    expect(badValue.result).not.toBe(0);
    expect(badValue.stderr.join("\n")).toMatch(/invalid.*(?:parallel-checks|-j).*nope|nope/i);

    const missing = await runInProject(project.cwd, ["outdated", "-j"]);
    expectKnownCommand(missing.combined, "outdated");
    expect(missing.result).not.toBe(0);
    expect(missing.stderr.join("\n")).toMatch(/missing|invalid|-j|parallel-checks/i);
  });

  test("-j does not enable JSON (human text remains)", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p7b-cli-j-not-json");
    writeLeafLock(project.cwd);

    const { result, stdout, combined } = await runInProject(project.cwd, [
      "outdated",
      "-j",
      "4",
    ]);
    expectKnownCommand(combined, "outdated");
    expectKnownOutdatedFlag(combined, "-j");
    expect(result).toBe(0);
    const text = stdout.join("\n").trim();
    expect(() => JSON.parse(text)).toThrow();
    expect(text).toMatch(/up-to-date|up to date|leaf/i);
  });

  test("unknown outdated flag still fails closed", async () => {
    project = createTempProject();
    writeEmptyDepsProject(project.cwd, "p7b-cli-badflag");
    writeLeafLock(project.cwd);

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "outdated",
      "--not-a-real-flag",
    ]);
    expectKnownCommand(combined, "outdated");
    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/not-a-real-flag|unknown.*flag/i);
  });
});
