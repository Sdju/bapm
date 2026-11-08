/**
 * CLI `cache info|clean|prune --shared` covers the opt-in shared HTTP cache
 * alongside git mirrors, without touching project apm_modules.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  expectKnownFlags,
  runInProject,
  type TempProject,
} from "../mcp/helpers.ts";

const CACHE_ENV = {
  BAPM_CACHE_DIR: undefined as string | undefined,
  BAPM_NO_CACHE: undefined,
  BAPM_HTTP_CACHE: undefined,
  BAPM_HTTP_CACHE_TTL: undefined,
};
const DAY_MS = 24 * 60 * 60 * 1000;

describe("CLI cache shared HTTP entries", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  function setup(): {
    cacheDir: string;
    gitDir: string;
    httpDir: string;
    httpEntry: string;
  } {
    project = createTempProject("bapm-cache-http-");
    const cacheDir = join(project.cwd, "shared-cache");
    const gitDir = join(cacheDir, "git");
    const httpDir = join(cacheDir, "http");
    const httpEntry = join(httpDir, "0123456789abcdef");
    mkdirSync(join(gitDir, "abc.git"), { recursive: true });
    mkdirSync(httpDir, { recursive: true });
    writeFileSync(join(gitDir, "abc.git", "marker"), "mirror\n");
    writeFileSync(httpEntry, '{"version":1}\n');
    return { cacheDir, gitDir, httpDir, httpEntry };
  }

  function env(cacheDir?: string): Record<string, string | undefined> {
    return { ...CACHE_ENV, BAPM_CACHE_DIR: cacheDir };
  }

  function age(path: string, days: number): void {
    const seconds = (Date.now() - days * DAY_MS) / 1000;
    utimesSync(path, seconds, seconds);
  }

  test("cache info reports shared HTTP entries and ttl", async () => {
    const { cacheDir, httpDir } = setup();
    const { result, combined } = await runInProject(project.cwd, ["cache", "info"], env(cacheDir));
    expectKnownFlags(combined);
    expect(result).toBe(0);
    expect(combined).toMatch(/shared http cache/i);
    expect(combined).toContain(httpDir);
    expect(combined).toMatch(/entries:\s*1/);
    expect(combined).toMatch(/ttl:\s*300s/);
  });

  test("cache info --shared includes both git and HTTP sections", async () => {
    const { cacheDir, gitDir, httpDir } = setup();
    const { result, combined } = await runInProject(
      project.cwd,
      ["cache", "info", "--shared"],
      env(cacheDir),
    );
    expectKnownFlags(combined);
    expect(result).toBe(0);
    expect(combined).toContain(gitDir);
    expect(combined).toContain(httpDir);
    expect(combined).toMatch(/shared git cache/i);
    expect(combined).toMatch(/shared http cache/i);
  });

  test("cache clean --shared clears HTTP entries and git mirrors only", async () => {
    const { cacheDir, gitDir, httpDir, httpEntry } = setup();
    const moduleFile = join(project.cwd, "apm_modules", "keep", "marker");
    mkdirSync(join(project.cwd, "apm_modules", "keep"), { recursive: true });
    writeFileSync(moduleFile, "kept\n");

    const refused = await runInProject(project.cwd, ["cache", "clean", "--shared"], env(cacheDir));
    expectKnownFlags(refused.combined);
    expect(refused.result).toBe(1);
    expect(existsSync(httpEntry)).toBe(true);

    const dry = await runInProject(
      project.cwd,
      ["cache", "clean", "--shared", "--dry-run"],
      env(cacheDir),
    );
    expect(dry.result).toBe(0);
    expect(existsSync(httpEntry)).toBe(true);

    const cleaned = await runInProject(
      project.cwd,
      ["cache", "clean", "--shared", "-y"],
      env(cacheDir),
    );
    expectKnownFlags(cleaned.combined);
    expect(cleaned.result).toBe(0);
    expect(cleaned.combined).toMatch(/shared http cache clean/i);
    expect(existsSync(httpEntry)).toBe(false);
    expect(existsSync(join(gitDir, "abc.git"))).toBe(false);
    expect(existsSync(join(httpDir, "0123456789abcdef"))).toBe(false);
    expect(existsSync(moduleFile)).toBe(true);
  });

  test("cache prune --shared prunes old HTTP entries (JSON)", async () => {
    const { cacheDir, httpDir } = setup();
    const old = join(httpDir, "old-entry");
    const recent = join(httpDir, "recent-entry");
    writeFileSync(old, "old");
    writeFileSync(recent, "recent");
    age(old, 40);
    age(join(httpDir, "0123456789abcdef"), 40);

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
    expect(json.pruned).toBe(2);
    expect(json.failed).toBe(0);
    expect(json.candidates).toEqual(["http/0123456789abcdef", "http/old-entry"]);
    expect(json.root).toBe(cacheDir);
    expect(existsSync(old)).toBe(false);
    expect(existsSync(recent)).toBe(true);
  });

  test("cache prune --shared --days applies the same window to HTTP entries", async () => {
    const { cacheDir, httpDir } = setup();
    const tenDays = join(httpDir, "ten-days");
    const fortyDays = join(httpDir, "forty-days");
    writeFileSync(tenDays, "ten");
    writeFileSync(fortyDays, "forty");
    age(tenDays, 10);
    age(fortyDays, 40);

    const kept = await runInProject(
      project.cwd,
      ["cache", "prune", "--shared", "--days", "20", "--json"],
      env(cacheDir),
    );
    expect(kept.result).toBe(0);
    expect(JSON.parse(kept.stdout.join("\n")).pruned).toBe(1);
    expect(existsSync(tenDays)).toBe(true);
    expect(existsSync(fortyDays)).toBe(false);

    const pruned = await runInProject(
      project.cwd,
      ["cache", "prune", "--shared", "--days", "5", "--json"],
      env(cacheDir),
    );
    expect(pruned.result).toBe(0);
    expect(existsSync(tenDays)).toBe(false);
  });

  test("cache help documents HTTP cache environment and prune scope", async () => {
    project = createTempProject("bapm-cache-http-help-");
    const { result, combined } = await runInProject(project.cwd, ["cache", "--help"]);
    expect(result).toBe(0);
    expect(combined).toMatch(/BAPM_HTTP_CACHE/);
    expect(combined).toMatch(/http/i);
  });
});
