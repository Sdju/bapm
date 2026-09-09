/**
 * CLI install: --trust-bin / --no-trust-bin known flags, mutual exclusion, help.
 * Specs: cli-runtime-surface, install-trust-bin.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  expectKnownFlags,
  fingerprintProject,
  formatInstallHelp,
  parseInstallArgs,
  runInProject,
  trustBinOf,
  writeLeafProject,
  type TempProject,
} from "./helpers.ts";

describe("install-trust-bin — CLI flags", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("--trust-bin is a known install flag and maps to allow consent", async () => {
    const parsed = parseInstallArgs(["--trust-bin"], { env: {} });
    expect(parsed.error).toBeUndefined();
    expect(trustBinOf(parsed as Record<string, unknown>)).toBe("allow");

    project = createTempProject();
    writeLeafProject(project.cwd, "cli-trust-bin", { withCursor: true });
    const { result, combined } = await runInProject(project.cwd, ["install", "--trust-bin"]);
    expectKnownCommand(combined, "install");
    expectKnownFlags(combined);
    expect(combined).not.toMatch(/Unknown install flag:\s*--trust-bin/i);
    expect(result).toBe(0);
  });

  test("--no-trust-bin is a known install flag and maps to deny consent", async () => {
    const parsed = parseInstallArgs(["--no-trust-bin"], { env: {} });
    expect(parsed.error).toBeUndefined();
    expect(trustBinOf(parsed as Record<string, unknown>)).toBe("deny");

    project = createTempProject();
    writeLeafProject(project.cwd, "cli-no-trust-bin", { withCursor: true });
    const { result, combined } = await runInProject(project.cwd, ["install", "--no-trust-bin"]);
    expectKnownCommand(combined, "install");
    expectKnownFlags(combined);
    expect(combined).not.toMatch(/Unknown install flag:\s*--no-trust-bin/i);
    expect(result).toBe(0);
  });

  test("combining --trust-bin and --no-trust-bin fails closed with conflict", async () => {
    const parsed = parseInstallArgs(["--trust-bin", "--no-trust-bin"], { env: {} });
    expect(parsed.error).toMatch(
      /conflict|mutually|both|--trust-bin.*--no-trust-bin|--no-trust-bin.*--trust-bin/i,
    );

    project = createTempProject();
    writeLeafProject(project.cwd, "cli-trust-conflict", { withCursor: true });
    const before = fingerprintProject(project.cwd);
    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--trust-bin",
      "--no-trust-bin",
    ]);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/conflict|mutually|both|--trust-bin|--no-trust-bin/i);
    expect(combined).not.toMatch(/Unknown install flag/i);
    expect(fingerprintProject(project.cwd)).toBe(before);
  });
});

describe("install-trust-bin — install help", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("install help lists trust-bin flags and non-interactive default", async () => {
    project = createTempProject();
    const viaFlag = await runInProject(project.cwd, ["install", "--help"]);
    const viaHelp = await runInProject(project.cwd, ["help", "install"]);
    const formatted = formatInstallHelp({
      name: "bapm",
      manifestFile: "bapm.yml",
      lockFile: "bapm.lock.yaml",
    });
    const text = [viaFlag.combined, viaHelp.combined, formatted].join("\n");

    expect(viaFlag.result === 0 || viaHelp.result === 0).toBe(true);
    expect(text).toMatch(/--trust-bin/);
    expect(text).toMatch(/--no-trust-bin/);
    expect(text).toMatch(/bin/i);
    expect(text).toMatch(/non-interactive|CI|frozen/i);
    expect(text).toMatch(/consent|allow|deny|policy|override/i);
  });
});
