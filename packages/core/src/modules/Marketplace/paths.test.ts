/**
 * Unit smoke: Marketplace paths resolve under injectable configDir, never ~/.apm.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ensureBapmConfigDir,
  getBapmConfigDir,
  marketplaceCacheDir,
  marketplacesJsonPath,
} from "@/modules/Marketplace";

describe("Marketplace paths", () => {
  let configDir: string | undefined;

  afterEach(() => {
    if (configDir) rmSync(configDir, { recursive: true, force: true });
    configDir = undefined;
  });

  test("resolves under temp configDir and never ~/.apm", () => {
    configDir = mkdtempSync(join(tmpdir(), "bapm-mp-unit-"));
    const root = ensureBapmConfigDir({ configDir });
    expect(root).toBe(configDir);
    expect(getBapmConfigDir({ configDir })).toBe(configDir);
    expect(marketplacesJsonPath({ configDir })).toBe(join(configDir, "marketplaces.json"));
    expect(marketplaceCacheDir({ configDir })).toBe(join(configDir, "cache", "marketplace"));
    expect(marketplacesJsonPath({ configDir })).not.toMatch(/\.apm/);
    expect(marketplaceCacheDir({ configDir })).not.toMatch(/\.apm/);
  });
});
