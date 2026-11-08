/**
 * `bapm cache prune --shared`: age-based shared mirror pruning.
 * Default cache prune must never touch project apm_modules.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  expectKnownFlags,
  runInProject,
  type TempProject,
} from "../mcp/helpers.ts";

const CACHE_ENV = { BAPM_CACHE_DIR: undefined as string | undefined, BAPM_NO_CACHE: undefined };
const DAY_MS = 24 * 60 * 60 * 1000;

describe("CLI cache prune", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  function age(path: string, days: number): void {
    const seconds = (Date.now() - days * DAY_MS) / 1000;
    utimesSync(path, seconds, seconds);
  }

  function setup(): { cacheDir: string; gitDir: string; old: string; recent: string } {
    project = createTempProject("bapm-cache-prune-");
    const cacheDir = join(project.cwd, "shared-cache");
    const gitDir = join(cacheDir, "git");
    const old = join(gitDir, "old.git");
    const recent = join(gitDir, "recent.git");
    mkdirSync(old, { recursive: true });
    mkdirSync(recent, { recursive: true });
    writeFileSync(join(old, "marker"), "old\n");
    writeFileSync(join(recent, "marker"), "recent\n");
    age(old, 40);
    // A sentinel module proves cache prune never acts on apm_modules.
    mkdirSync(join(project.cwd, "apm_modules", "keep"), { recursive: true });
    writeFileSync(join(project.cwd, "apm_modules", "keep", "marker"), "keep\n");
    return { cacheDir, gitDir, old, recent };
  }

  function env(cacheDir?: string): Record<string, string | undefined> {
    return { ...CACHE_ENV, BAPM_CACHE_DIR: cacheDir };
  }

  test("--shared prunes mirrors older than the default 30 days (JSON)", async () => {
    const { cacheDir, gitDir, old, recent } = setup();

    const { result, stdout, combined } = await runInProject(
      project.cwd,
      ["cache", "prune", "--shared", "--json"],
      env(cacheDir),
    );
    expectKnownFlags(combined);
    expect(result).toBe(0);

    const json = JSON.parse(stdout.join("\n")) as {
      pruned: number;
      failed: number;
      candidates: string[];
      root: string | null;
    };
    expect(Object.keys(json).sort()).toEqual(["candidates", "failed", "pruned", "root"]);
    expect(json.pruned).toBe(1);
    expect(json.failed).toBe(0);
    expect(json.candidates).toEqual(["old.git"]);
    expect(json.root).toBe(gitDir);
    expect(existsSync(old)).toBe(false);
    expect(existsSync(recent)).toBe(true);
    expect(existsSync(join(project.cwd, "apm_modules", "keep", "marker"))).toBe(true);
  });

  test("--days tightens the retention window", async () => {
    const { cacheDir, old } = setup();
    age(old, 10);

    const kept = await runInProject(
      project.cwd,
      ["cache", "prune", "--shared", "--days", "20", "--json"],
      env(cacheDir),
    );
    expect(kept.result).toBe(0);
    expect(JSON.parse(kept.stdout.join("\n")).pruned).toBe(0);
    expect(existsSync(old)).toBe(true);

    const pruned = await runInProject(
      project.cwd,
      ["cache", "prune", "--shared", "--days", "5", "--json"],
      env(cacheDir),
    );
    expect(pruned.result).toBe(0);
    expect(JSON.parse(pruned.stdout.join("\n")).pruned).toBe(1);
    expect(existsSync(old)).toBe(false);
  });

  test("--dry-run lists candidates and leaves all mirrors in place", async () => {
    const { cacheDir, old, recent } = setup();

    const { result, combined } = await runInProject(
      project.cwd,
      ["cache", "prune", "--shared", "--dry-run"],
      env(cacheDir),
    );
    expectKnownFlags(combined);
    expect(result).toBe(0);
    expect(combined).toMatch(/dry-run|would prune/i);
    expect(combined).toContain("old.git");
    expect(combined).not.toContain("recent.git");
    expect(existsSync(old)).toBe(true);
    expect(existsSync(recent)).toBe(true);
  });

  test("unset BAPM_CACHE_DIR exits 0 with shared-cache-not-configured (JSON too)", async () => {
    project = createTempProject("bapm-cache-prune-off-");

    const { result, stdout, combined } = await runInProject(
      project.cwd,
      ["cache", "prune", "--shared", "--json"],
      env(undefined),
    );
    expectKnownFlags(combined);
    expect(result).toBe(0);
    expect(combined).toMatch(/shared cache not configured/i);
    expect(JSON.parse(stdout.join("\n"))).toEqual({
      pruned: 0,
      failed: 0,
      candidates: [],
      root: null,
    });
  });

  test("without --shared it points at bapm prune and never deletes apm_modules", async () => {
    const { cacheDir, old } = setup();
    const moduleFile = join(project.cwd, "apm_modules", "keep", "marker");

    const { result, combined } = await runInProject(
      project.cwd,
      ["cache", "prune", "--days", "1"],
      env(cacheDir),
    );
    expectKnownFlags(combined);
    expect(result).toBe(0);
    expect(combined).toMatch(/bapm prune/i);
    expect(combined).toMatch(/--shared/);
    expect(existsSync(moduleFile)).toBe(true);
    // Shared mirrors are also untouched without --shared.
    expect(existsSync(old)).toBe(true);
    expect(readdirSync(join(cacheDir, "git")).length).toBeGreaterThan(0);
  });

  test("negative --days is rejected before touching mirrors", async () => {
    const { cacheDir, old } = setup();

    const { result, combined } = await runInProject(
      project.cwd,
      ["cache", "prune", "--shared", "--days", "-1"],
      env(cacheDir),
    );
    expectKnownFlags(combined);
    expect(result).toBe(1);
    expect(combined).toMatch(/nonnegative|non-negative/i);
    expect(existsSync(old)).toBe(true);
  });

  test("help documents prune, --days, --json, and --shared", async () => {
    project = createTempProject("bapm-cache-prune-help-");
    const { result, combined } = await runInProject(project.cwd, ["cache", "--help"]);
    expect(result).toBe(0);
    expect(combined).toMatch(/cache prune/i);
    expect(combined).toMatch(/--days/);
    expect(combined).toMatch(/--json/);
    expect(combined).toMatch(/--shared/);
    expect(combined).toMatch(/bapm prune/i);
  });
});
