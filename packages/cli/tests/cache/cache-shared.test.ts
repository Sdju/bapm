/**
 * `bapm cache info|clean --shared` over the opt-in shared git mirror cache.
 * Default `cache clean` must stay project-modules-only.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  expectKnownFlags,
  runInProject,
  writeModulesCacheProject,
  type TempProject,
} from "../mcp/helpers.ts";

const CACHE_ENV = { BAPM_CACHE_DIR: undefined as string | undefined, BAPM_NO_CACHE: undefined };

describe("CLI cache --shared", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  function setup(): { cacheDir: string; mirror: string } {
    project = createTempProject("bapm-cache-shared-");
    writeModulesCacheProject(project.cwd);
    const cacheDir = join(project.cwd, "shared-cache");
    const mirror = join(cacheDir, "git", "abc123.git");
    mkdirSync(mirror, { recursive: true });
    writeFileSync(join(mirror, "marker"), "mirror\n");
    return { cacheDir, mirror };
  }

  function env(cacheDir?: string): Record<string, string | undefined> {
    return { ...CACHE_ENV, BAPM_CACHE_DIR: cacheDir };
  }

  test("cache info shows shared path and mirror stats when configured", async () => {
    const { cacheDir } = setup();
    const { result, combined } = await runInProject(project.cwd, ["cache", "info"], env(cacheDir));
    expectKnownFlags(combined);
    expect(result).toBe(0);
    expect(combined).toMatch(/shared git cache/i);
    expect(combined).toContain(join(cacheDir, "git"));
    expect(combined).toMatch(/mirrors:\s*1/);
    expect(combined).toMatch(/size:\s*\d+\s*bytes/);
  });

  test("cache info --shared is explicit and clear when disabled", async () => {
    project = createTempProject("bapm-cache-shared-off-");
    const { result, combined } = await runInProject(
      project.cwd,
      ["cache", "info", "--shared"],
      env(undefined),
    );
    expectKnownFlags(combined);
    expect(result).toBe(0);
    expect(combined).toMatch(/shared git cache/i);
    expect(combined).toMatch(/disabled/i);
  });

  test("default cache clean removes apm_modules but leaves shared mirrors", async () => {
    const { cacheDir, mirror } = setup();
    const install = await runInProject(
      project.cwd,
      ["install", "--target", "cursor"],
      env(cacheDir),
    );
    expect(install.result).toBe(0);
    expect(existsSync(join(project.cwd, "apm_modules"))).toBe(true);

    const { result, combined } = await runInProject(
      project.cwd,
      ["cache", "clean", "-y"],
      env(cacheDir),
    );
    expectKnownFlags(combined);
    expect(result).toBe(0);
    expect(existsSync(mirror)).toBe(true);
    const modules = join(project.cwd, "apm_modules");
    const empty =
      !existsSync(modules) ||
      readdirSync(modules).filter((n) => n !== "." && n !== "..").length === 0;
    expect(empty).toBe(true);
  });

  test("cache clean --shared removes mirrors only", async () => {
    const { cacheDir, mirror } = setup();
    const keep = join(project.cwd, "apm_modules", "keep");
    mkdirSync(keep, { recursive: true });
    writeFileSync(join(keep, "marker"), "kept\n");

    const refused = await runInProject(project.cwd, ["cache", "clean", "--shared"], env(cacheDir));
    expectKnownFlags(refused.combined);
    expect(refused.result).toBe(1);
    expect(existsSync(mirror)).toBe(true);

    const dry = await runInProject(
      project.cwd,
      ["cache", "clean", "--shared", "--dry-run"],
      env(cacheDir),
    );
    expect(dry.result).toBe(0);
    expect(dry.combined).toMatch(/would remove 1/i);
    expect(existsSync(mirror)).toBe(true);

    const cleaned = await runInProject(
      project.cwd,
      ["cache", "clean", "--shared", "-y"],
      env(cacheDir),
    );
    expectKnownFlags(cleaned.combined);
    expect(cleaned.result).toBe(0);
    expect(cleaned.combined).toMatch(/apm_modules untouched/i);
    expect(existsSync(mirror)).toBe(false);
    expect(existsSync(join(keep, "marker"))).toBe(true);
  });

  test("cache help documents --shared", async () => {
    project = createTempProject("bapm-cache-shared-help-");
    const { result, combined } = await runInProject(project.cwd, ["cache", "--help"]);
    expect(result).toBe(0);
    expect(combined).toMatch(/--shared/);
    expect(combined).toMatch(/BAPM_CACHE_DIR/);
  });
});
