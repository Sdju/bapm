/**
 * Unit: cacheClean dryRun preview + refuse-without-yes.
 */
import { cacheClean } from "@bapm/core";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";

describe("cacheClean dryRun unit", () => {
  let cwd: string;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
  });

  function project(withModules?: string[]): void {
    cwd = mkdtempSync(join(tmpdir(), "bapm-cache-clean-unit-"));
    if (withModules) {
      const root = join(cwd, "apm_modules");
      mkdirSync(root, { recursive: true });
      for (const name of withModules) {
        const dir = join(root, name);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "marker"), "x", "utf8");
      }
    }
  }

  function entryCount(): number {
    const root = join(cwd, "apm_modules");
    if (!existsSync(root)) return 0;
    return readdirSync(root).filter((n) => n !== "." && n !== "..").length;
  }

  test("dry-run leaves entries and does not require yes", () => {
    project(["alpha", "beta"]);
    expect(entryCount()).toBe(2);

    const r = cacheClean({ cwd, dryRun: true });
    expect(r.ok).toBe(true);
    expect(r.cleaned).toBe(false);
    expect(r.removedEntries).toBe(2);
    expect(r.refused).not.toBe(true);
    expect(entryCount()).toBe(2);
    expect(r.message).toMatch(/dry-run|would remove/i);
  });

  test("dry-run without yes succeeds", () => {
    project(["keep"]);
    const r = cacheClean({ cwd, dryRun: true });
    expect(r.ok).toBe(true);
    expect(r.refused).not.toBe(true);
    expect(entryCount()).toBe(1);
  });

  test("dry-run absent root ok with would-remove 0", () => {
    project();
    const r = cacheClean({ cwd, dryRun: true });
    expect(r.ok).toBe(true);
    expect(r.cleaned).toBe(false);
    expect(r.removedEntries).toBe(0);
    expect(r.message).toMatch(/0|absent|empty/i);
  });

  test("without dryRun and without yes still refuses", () => {
    project(["keep"]);
    const r = cacheClean({ cwd });
    expect(r.ok).toBe(false);
    expect(r.refused).toBe(true);
    expect(entryCount()).toBe(1);
  });
});
