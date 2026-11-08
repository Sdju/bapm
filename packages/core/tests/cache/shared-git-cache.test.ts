/**
 * Shared git cache info/clean exposure from the Cache module.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  BAPM_CACHE_DIR_ENV,
  BAPM_NO_CACHE_ENV,
  cacheInfo,
  sharedGitCacheClean,
  sharedGitCacheInfo,
} from "@b-apm/core";

describe("shared git cache info/clean", () => {
  let root: string;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  function setup(): { cacheDir: string; cwd: string } {
    root = mkdtempSync(join(tmpdir(), "bapm-shared-info-"));
    const cacheDir = join(root, "cache");
    const mirror = join(cacheDir, "git", "abc123.git");
    mkdirSync(mirror, { recursive: true });
    writeFileSync(join(mirror, "marker"), "mirror\n");
    const cwd = join(root, "project");
    mkdirSync(join(cwd, "apm_modules", "pkg"), { recursive: true });
    writeFileSync(join(cwd, "apm_modules", "pkg", "file"), "modules\n");
    return { cacheDir, cwd };
  }

  function env(cacheDir?: string): Record<string, string | undefined> {
    return {
      [BAPM_CACHE_DIR_ENV]: cacheDir,
      [BAPM_NO_CACHE_ENV]: undefined,
    };
  }

  test("info reports shared path, mirror count, and size", () => {
    const { cacheDir, cwd } = setup();
    const info = sharedGitCacheInfo({ env: env(cacheDir) });
    expect(info.enabled).toBe(true);
    expect(info.cacheDir).toBe(cacheDir);
    expect(info.gitDir).toBe(join(cacheDir, "git"));
    expect(info.mirrors).toBe(1);
    expect(info.sizeBytes).toBeGreaterThan(0);
    expect(info.text).toMatch(/shared git cache/i);
    expect(info.text).toContain(join(cacheDir, "git"));

    // Project info also surfaces the shared section when configured.
    const combined = cacheInfo({ cwd, env: env(cacheDir) });
    expect(combined.text).toContain("apm_modules");
    expect(combined.text).toMatch(/shared git cache/i);
    expect(combined.shared?.mirrors).toBe(1);
  });

  test("disabled info is clear and stable", () => {
    const info = sharedGitCacheInfo({ env: {} });
    expect(info.enabled).toBe(false);
    expect(info.reason).toBe("env-unset");
    expect(info.text).toMatch(/disabled/i);
    expect(info.text).toMatch(/BAPM_CACHE_DIR/);
  });

  test("BAPM_NO_CACHE still reports a configured cache but disables use", () => {
    const { cacheDir } = setup();
    const info = sharedGitCacheInfo({
      env: { [BAPM_CACHE_DIR_ENV]: cacheDir, [BAPM_NO_CACHE_ENV]: "1" },
    });
    expect(info.enabled).toBe(false);
    expect(info.reason).toBe("no-cache");
    expect(info.gitDir).toBe(join(cacheDir, "git"));
    expect(info.text).toMatch(/BAPM_NO_CACHE/);
  });

  test("clean is shared-only, requires yes, and never deletes apm_modules", () => {
    const { cacheDir, cwd } = setup();
    const mirror = join(cacheDir, "git", "abc123.git");
    const projectFile = join(cwd, "apm_modules", "pkg", "file");

    const dry = sharedGitCacheClean({ env: env(cacheDir), dryRun: true });
    expect(dry.ok).toBe(true);
    expect(dry.removedEntries).toBe(1);
    expect(existsSync(mirror)).toBe(true);

    const refused = sharedGitCacheClean({ env: env(cacheDir) });
    expect(refused.ok).toBe(false);
    expect(refused.refused).toBe(true);
    expect(existsSync(mirror)).toBe(true);

    const cleaned = sharedGitCacheClean({ env: env(cacheDir), yes: true });
    expect(cleaned.ok).toBe(true);
    expect(cleaned.cleaned).toBe(true);
    expect(cleaned.removedEntries).toBe(1);
    expect(existsSync(mirror)).toBe(false);
    expect(readFileSync(projectFile, "utf8")).toBe("modules\n");
  });

  test("clean with no configured cache is a no-op", () => {
    const result = sharedGitCacheClean({ env: {} });
    expect(result.ok).toBe(true);
    expect(result.cleaned).toBe(false);
    expect(result.removedEntries).toBe(0);
    expect(result.message).toMatch(/disabled/i);
  });
});
