/**
 * p7c — CLI deps help short-form + dry-run docs; fail-closed flags.
 * Spec: cli-runtime-surface.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  runCli,
  runInProject,
  withCapturedIo,
  writeManifest,
  writeTransitiveLock,
  type TempProject,
} from "./helpers.ts";

describe("p7c CLI deps help + fail-closed", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("deps help documents basename / owner/repo why examples and clean --dry-run", async () => {
    const viaDepsHelp = await withCapturedIo(() => runCli(["deps", "--help"]));
    expect(viaDepsHelp.result).toBe(0);
    const text = [...viaDepsHelp.stdout, ...viaDepsHelp.stderr].join("\n");

    expect(text).toMatch(/basename|shared-utils|owner\/repo|acme-org\/shared-utils/i);
    expect(text).toMatch(/--dry-run/);
    expect(text).toMatch(/\bclean\b/i);
    expect(text).not.toMatch(/shared (?:git|http) cache|~\/\.apm/i);
  });

  test("--dry-run on deps why fails closed", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p7c-why-dry-run-flag");
    writeTransitiveLock(project.cwd);

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "deps",
      "why",
      "org/child",
      "--dry-run",
    ]);
    expectKnownCommand(combined, "deps");
    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/--dry-run|unknown|unsupported/i);
  });

  test("unknown deps flag still fails closed", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p7c-bad-flag");
    writeTransitiveLock(project.cwd);

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "deps",
      "list",
      "--not-a-real-flag",
    ]);
    expectKnownCommand(combined, "deps");
    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/not-a-real-flag|unknown.*flag/i);
  });
});
