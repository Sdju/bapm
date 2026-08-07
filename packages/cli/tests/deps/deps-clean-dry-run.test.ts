/**
 * p7c — CLI deps clean --dry-run preview (SHOULD) + refuse-without-yes regression.
 * Specs: deps-inspect, cli-runtime-surface, cache-cli-ux.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  expectKnownDepsSubcommand,
  expectKnownFlag,
  modulesEmpty,
  modulesEntryCount,
  populateModules,
  runInProject,
  writeManifest,
  writeTransitiveLock,
  type TempProject,
} from "./helpers.ts";

describe("p7c CLI deps clean --dry-run", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("dry-run does not delete and does not require -y", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p7c-clean-dry-run");
    writeTransitiveLock(project.cwd);
    populateModules(project.cwd, ["alpha", "beta"]);
    expect(modulesEntryCount(project.cwd)).toBe(2);

    const { result, combined } = await runInProject(project.cwd, ["deps", "clean", "--dry-run"]);
    expectKnownCommand(combined, "deps");
    expectKnownDepsSubcommand(combined, "clean");
    expectKnownFlag(combined, "--dry-run");
    expect(result).toBe(0);
    expect(modulesEntryCount(project.cwd)).toBe(2);
    expect(combined).toMatch(/dry.?run|would|preview|2|alpha|beta/i);
  });

  test("dry-run absent apm_modules exits 0 (already clean / would-remove 0)", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p7c-clean-dry-absent");
    writeTransitiveLock(project.cwd);
    expect(modulesEmpty(project.cwd)).toBe(true);

    const { result, combined } = await runInProject(project.cwd, ["deps", "clean", "--dry-run"]);
    expectKnownCommand(combined, "deps");
    expectKnownDepsSubcommand(combined, "clean");
    expectKnownFlag(combined, "--dry-run");
    expect(result).toBe(0);
    expect(combined).toMatch(/already|empty|0|absent|nothing|clean/i);
  });

  test("real wipe without -y still refuses and keeps modules", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p7c-clean-refuse");
    writeTransitiveLock(project.cwd);
    populateModules(project.cwd, ["keep-me"]);
    expect(modulesEntryCount(project.cwd)).toBe(1);

    const { result, combined } = await runInProject(project.cwd, ["deps", "clean"]);
    expectKnownCommand(combined, "deps");
    expectKnownDepsSubcommand(combined, "clean");
    expect(result).not.toBe(0);
    expect(modulesEntryCount(project.cwd)).toBe(1);
    expect(combined).toMatch(/-y|--yes|refus|require/i);
  });
});
