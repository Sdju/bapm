/**
 * p6f — CLI `deps clean` ≡ modules wipe (`cache clean`), not shared git/http cache.
 * Specs: deps-inspect, cli-runtime-surface.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  expectKnownDepsSubcommand,
  modulesEmpty,
  modulesEntryCount,
  populateModules,
  runInProject,
  writeManifest,
  writeTransitiveLock,
  type TempProject,
} from "./helpers.ts";

describe("p6f CLI deps clean modules wipe", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("deps clean -y is recognized and wipes apm_modules like cache clean -y", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p6f-clean-equiv");
    writeTransitiveLock(project.cwd);
    populateModules(project.cwd, ["alpha", "beta"]);
    expect(modulesEntryCount(project.cwd)).toBe(2);

    const depsClean = await runInProject(project.cwd, ["deps", "clean", "-y"]);
    expectKnownCommand(depsClean.combined, "deps");
    expectKnownDepsSubcommand(depsClean.combined, "clean");
    expect(depsClean.result).toBe(0);
    expect(modulesEmpty(project.cwd)).toBe(true);

    // Same tree rebuilt — cache clean -y must leave the same empty modules state.
    populateModules(project.cwd, ["alpha", "beta"]);
    expect(modulesEntryCount(project.cwd)).toBe(2);
    const cacheClean = await runInProject(project.cwd, ["cache", "clean", "-y"]);
    expect(cacheClean.result).toBe(0);
    expect(modulesEmpty(project.cwd)).toBe(true);
  });

  test("deps clean without -y/--yes refuses and keeps modules", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p6f-clean-refuse");
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

  test("deps clean -y with absent apm_modules exits 0 (already clean)", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p6f-clean-absent");
    writeTransitiveLock(project.cwd);
    expect(modulesEmpty(project.cwd)).toBe(true);

    const { result, combined } = await runInProject(project.cwd, ["deps", "clean", "-y"]);
    expectKnownCommand(combined, "deps");
    expectKnownDepsSubcommand(combined, "clean");
    expect(result).toBe(0);
  });

  test("deps clean --yes is accepted as yes alias", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p6f-clean-yes");
    writeTransitiveLock(project.cwd);
    populateModules(project.cwd, ["one"]);

    const { result, combined } = await runInProject(project.cwd, ["deps", "clean", "--yes"]);
    expectKnownCommand(combined, "deps");
    expectKnownDepsSubcommand(combined, "clean");
    expect(result).toBe(0);
    expect(modulesEmpty(project.cwd)).toBe(true);
  });
});
