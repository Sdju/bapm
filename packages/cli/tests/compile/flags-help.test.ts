/**
 * p7d — CLI compile help + parse + fail-closed (cli-runtime-surface).
 * MUST: document -o/--output, --dry-run, -v/--verbose, --validate;
 * omit deferred --no-links and multi-host flags; unknown fail-closed.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  formatCompileHelp,
  parseCompileArgs,
  runCli,
  runInProject,
  withCapturedIo,
  writeCompileProject,
  type TempProject,
} from "./helpers.ts";

describe("p7d CLI compile help + fail-closed", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("compile help lists -o/--output, --dry-run, -v/--verbose, --validate", async () => {
    const viaFlag = await withCapturedIo(() => runCli(["compile", "--help"]));
    const viaShort = await withCapturedIo(() => runCli(["compile", "-h"]));
    const text = [
      [...viaFlag.stdout, ...viaFlag.stderr].join("\n"),
      [...viaShort.stdout, ...viaShort.stderr].join("\n"),
      formatCompileHelp({ name: "bapm", manifestFile: "bapm.yml", lockFile: "bapm.lock.yaml" }),
    ].join("\n");

    expect(viaFlag.result).toBe(0);
    expect(viaShort.result).toBe(0);
    expect(text).toMatch(/-o\b|--output\b/);
    expect(text).toMatch(/--output\b/);
    expect(text).toMatch(/--dry-run\b/);
    expect(text).toMatch(/-v\b|--verbose\b/);
    expect(text).toMatch(/--verbose\b/);
    expect(text).toMatch(/--validate\b/);
    expect(text).not.toMatch(/optimizer|distributed placement|multi-host/i);
  });

  test("compile help omits deferred --no-links and multi-host flags", async () => {
    const viaFlag = await withCapturedIo(() => runCli(["compile", "--help"]));
    const text = [
      [...viaFlag.stdout, ...viaFlag.stderr].join("\n"),
      formatCompileHelp({ name: "bapm", manifestFile: "bapm.yml", lockFile: "bapm.lock.yaml" }),
    ].join("\n");

    expect(viaFlag.result).toBe(0);
    expect(text).not.toMatch(/--no-links\b/);
    expect(text).toMatch(/--target\s+<id>/);
    expect(text).toMatch(/\bactive\b/i);
    expect(text).not.toMatch(/--all\b/);
    expect(text).not.toMatch(/--global\b/);
    expect(text).not.toMatch(/-g\b.*global|global.*-g\b/i);
    expect(text).not.toMatch(/--watch\b/);
    expect(text).not.toMatch(/--root\b/);
    expect(text).not.toMatch(/--clean\b/);
    expect(text).not.toMatch(/--single-agents\b/);
  });

  test("parseCompileArgs accepts -o/--output, --dry-run, -v/--verbose, --validate", () => {
    const outSpace = parseCompileArgs(["-o", "nested/OUT.md", "--dry-run", "-v", "--validate"]);
    expect(outSpace.error).toBeUndefined();
    expect((outSpace as { outputFile?: string }).outputFile).toBe("nested/OUT.md");
    expect((outSpace as { dryRun?: boolean }).dryRun).toBe(true);
    expect((outSpace as { verbose?: boolean }).verbose).toBe(true);
    expect((outSpace as { validate?: boolean }).validate).toBe(true);

    const outLong = parseCompileArgs(["--output", "AGENTS.md", "--verbose"]);
    expect(outLong.error).toBeUndefined();
    expect((outLong as { outputFile?: string }).outputFile).toBe("AGENTS.md");
    expect((outLong as { verbose?: boolean }).verbose).toBe(true);

    const omitted = parseCompileArgs([]);
    expect(omitted.error).toBeUndefined();
    expect((omitted as { outputFile?: string }).outputFile).toBeUndefined();
    expect((omitted as { dryRun?: boolean }).dryRun).not.toBe(true);
    expect((omitted as { verbose?: boolean }).verbose).not.toBe(true);
  });

  test("parseCompileArgs missing -o/--output value errors", () => {
    const short = parseCompileArgs(["-o"]);
    expect(short.error).toBeTruthy();

    const long = parseCompileArgs(["--output"]);
    expect(long.error).toBeTruthy();
  });

  test("unknown compile flag fails closed", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd, "p7d-bad-flag");

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "compile",
      "--not-a-real-flag",
    ]);
    expectKnownCommand(combined, "compile");
    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/not-a-real-flag|unknown.*flag/i);
  });
});
