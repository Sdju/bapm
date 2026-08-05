/**
 * p6f — CLI deps help / flag surface + list/tree regression.
 * Spec: cli-runtime-surface.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  expectKnownDepsSubcommand,
  runCli,
  runInProject,
  withCapturedIo,
  writeManifest,
  writeTransitiveLock,
  type TempProject,
} from "./helpers.ts";

describe("p6f CLI deps help + fail-closed + list/tree regression", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("deps help mentions why --json and clean ≡ modules wipe / cache clean", async () => {
    const viaDepsHelp = await withCapturedIo(() => runCli(["deps", "--help"]));
    expect(viaDepsHelp.result).toBe(0);
    const text = [...viaDepsHelp.stdout, ...viaDepsHelp.stderr].join("\n");

    expect(text).toMatch(/--json/);
    expect(text).toMatch(/\bclean\b/i);
    expect(text).toMatch(/modules|cache clean|apm_modules/i);
    // Must not imply APM shared git/http cache wipe.
    expect(text).not.toMatch(/shared (?:git|http) cache|~\/\.apm/i);
  });

  test("--json on deps list fails closed", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p6f-list-json");
    writeTransitiveLock(project.cwd);

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "deps",
      "list",
      "--json",
    ]);
    expectKnownCommand(combined, "deps");
    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/--json|unknown|unsupported/i);
  });

  test("deps clean is not an unknown subcommand", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p6f-clean-known");
    writeTransitiveLock(project.cwd);

    const { combined } = await runInProject(project.cwd, ["deps", "clean", "-y"]);
    expectKnownCommand(combined, "deps");
    expectKnownDepsSubcommand(combined, "clean");
  });

  test("deps list and tree still work (regression)", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p6f-list-tree");
    writeTransitiveLock(project.cwd);

    const list = await runInProject(project.cwd, ["deps", "list"]);
    expectKnownCommand(list.combined, "deps");
    expect(list.result).toBe(0);
    expect(list.combined).toMatch(/org\/parent|org\/child|parent|child/i);

    const tree = await runInProject(project.cwd, ["deps", "tree"]);
    expectKnownCommand(tree.combined, "deps");
    expect(tree.result).toBe(0);
    expect(tree.combined).toMatch(/org\/parent|org\/child|parent|child/i);
  });

  test("unknown deps flag still fails closed", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p6f-bad-flag");
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
