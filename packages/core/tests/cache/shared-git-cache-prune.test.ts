/**
 * Core shared git cache prune: age threshold, dry-run, safe deletion, failures.
 */
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { BAPM_CACHE_DIR_ENV, BAPM_NO_CACHE_ENV, pruneSharedCache } from "@b-apm/core";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("pruneSharedCache", () => {
  let root: string;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  function env(cacheDir?: string): Record<string, string | undefined> {
    return {
      [BAPM_CACHE_DIR_ENV]: cacheDir,
      [BAPM_NO_CACHE_ENV]: undefined,
    };
  }

  function setup(): { cacheDir: string; gitDir: string; cwd: string } {
    root = mkdtempSync(join(tmpdir(), "bapm-shared-prune-"));
    const cacheDir = join(root, "cache");
    const gitDir = join(cacheDir, "git");
    mkdirSync(gitDir, { recursive: true });
    const cwd = join(root, "project");
    mkdirSync(join(cwd, "apm_modules", "keep"), { recursive: true });
    writeFileSync(join(cwd, "apm_modules", "keep", "marker"), "keep\n");
    return { cacheDir, gitDir, cwd };
  }

  function mirror(gitDir: string, name: string, ageDays?: number): string {
    const path = join(gitDir, name);
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, "marker"), "mirror\n");
    if (ageDays !== undefined) age(path, ageDays);
    return path;
  }

  function age(path: string, days: number): void {
    const seconds = (Date.now() - days * DAY_MS) / 1000;
    utimesSync(path, seconds, seconds);
  }

  test("default 30-day threshold prunes old mirrors and keeps recent ones", () => {
    const { cacheDir, gitDir, cwd } = setup();
    const old = mirror(gitDir, "old.git", 40);
    const recent = mirror(gitDir, "recent.git", 5);

    const result = pruneSharedCache({ env: env(cacheDir) });

    expect(result.ok).toBe(true);
    expect(result.pruned).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.candidates).toEqual(["old.git"]);
    expect(result.root).toBe(gitDir);
    expect(existsSync(old)).toBe(false);
    expect(existsSync(recent)).toBe(true);
    // Project modules are never touched by shared-cache prune.
    expect(existsSync(join(cwd, "apm_modules", "keep", "marker"))).toBe(true);
  });

  test("--days threshold selects only mirrors older than the requested age", () => {
    const { cacheDir, gitDir } = setup();
    const tenDays = mirror(gitDir, "ten.git", 10);
    const fortyDays = mirror(gitDir, "forty.git", 40);

    const strict = pruneSharedCache({ env: env(cacheDir), days: 20 });
    expect(strict.pruned).toBe(1);
    expect(strict.candidates).toEqual(["forty.git"]);
    expect(existsSync(tenDays)).toBe(true);
    expect(existsSync(fortyDays)).toBe(false);

    const loose = pruneSharedCache({ env: env(cacheDir), days: 5 });
    expect(loose.pruned).toBe(1);
    expect(loose.candidates).toEqual(["ten.git"]);
    expect(existsSync(tenDays)).toBe(false);
  });

  test("days 0 makes all past mirrors eligible without a negative age", () => {
    const { cacheDir, gitDir } = setup();
    const a = mirror(gitDir, "a.git", 1);
    const b = mirror(gitDir, "b.git", 30);
    const justCreated = mirror(gitDir, "just-created.git");

    const result = pruneSharedCache({ env: env(cacheDir), days: 0 });
    expect(result.ok).toBe(true);
    expect(result.pruned).toBe(3);
    expect(result.candidates).toEqual(["a.git", "b.git", "just-created.git"]);
    expect(existsSync(a)).toBe(false);
    expect(existsSync(b)).toBe(false);
    expect(existsSync(justCreated)).toBe(false);
  });

  test("negative and non-integer days are rejected before touching the cache", () => {
    const { cacheDir, gitDir } = setup();
    const old = mirror(gitDir, "old.git", 40);

    for (const days of [-1, 1.5, Number.NaN]) {
      const result = pruneSharedCache({ env: env(cacheDir), days });
      expect(result.ok).toBe(false);
      expect(result.refused).toBe(true);
      expect(result.pruned).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.message).toMatch(/nonnegative integer/i);
      expect(existsSync(old)).toBe(true);
    }
  });

  test("dry-run lists candidates and deletes nothing", () => {
    const { cacheDir, gitDir } = setup();
    const old = mirror(gitDir, "old.git", 40);
    const recent = mirror(gitDir, "recent.git", 1);

    const result = pruneSharedCache({ env: env(cacheDir), dryRun: true });
    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.pruned).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.candidates).toEqual(["old.git"]);
    expect(result.message).toMatch(/dry-run|would prune/i);
    expect(existsSync(old)).toBe(true);
    expect(existsSync(recent)).toBe(true);
  });

  test("unset BAPM_CACHE_DIR is a successful informative no-op", () => {
    const result = pruneSharedCache({ env: {} });
    expect(result.ok).toBe(true);
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("env-unset");
    expect(result.pruned).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.candidates).toEqual([]);
    expect(result.root).toBeUndefined();
    expect(result.message).toMatch(/shared cache not configured/i);
    expect(result.message).toMatch(/bapm prune/i);
  });

  test("partial removal failures are counted per mirror and do not stop the sweep", () => {
    if (
      process.platform === "win32" ||
      (typeof process.getuid === "function" && process.getuid() === 0)
    ) {
      // Permission bits do not reliably deny deletion for root/Windows.
      return;
    }
    const { cacheDir, gitDir } = setup();
    const failing = mirror(gitDir, "failing.git");
    const removable = mirror(gitDir, "removable.git", 40);
    const locked = join(failing, "locked");
    mkdirSync(locked, { recursive: true });
    writeFileSync(join(locked, "file"), "locked\n");
    chmodSync(locked, 0o000);
    // Age the mirror after adding the locked child so it stays a candidate.
    age(failing, 40);

    try {
      const result = pruneSharedCache({ env: env(cacheDir) });
      expect(result.ok).toBe(false);
      expect(result.pruned).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]?.name).toBe("failing.git");
      expect(result.message).toMatch(/1 failed/i);
      expect(existsSync(failing)).toBe(true);
      expect(existsSync(removable)).toBe(false);
    } finally {
      chmodSync(locked, 0o700);
    }
  });

  test("symlinked entries are skipped, never followed or deleted", () => {
    const { cacheDir, gitDir } = setup();
    const outside = join(root, "outside");
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, "marker"), "outside\n");
    age(outside, 40);
    const link = join(gitDir, "linked.git");
    symlinkSync(outside, link, "dir");

    const result = pruneSharedCache({ env: env(cacheDir) });
    expect(result.ok).toBe(true);
    expect(result.pruned).toBe(0);
    expect(result.candidates).toEqual([]);
    expect(existsSync(link)).toBe(true);
    expect(existsSync(join(outside, "marker"))).toBe(true);
  });

  test("requireYes refuses without -y and leaves candidates intact", () => {
    const { cacheDir, gitDir } = setup();
    const old = mirror(gitDir, "old.git", 40);

    const refused = pruneSharedCache({ env: env(cacheDir), requireYes: true });
    expect(refused.ok).toBe(false);
    expect(refused.refused).toBe(true);
    expect(existsSync(old)).toBe(true);

    const cleaned = pruneSharedCache({ env: env(cacheDir), requireYes: true, yes: true });
    expect(cleaned.ok).toBe(true);
    expect(cleaned.pruned).toBe(1);
    expect(existsSync(old)).toBe(false);
  });
});
