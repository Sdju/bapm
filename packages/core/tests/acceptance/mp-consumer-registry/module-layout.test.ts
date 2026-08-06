/**
 * Acceptance: core-feod Marketplace module boundary + public exports.
 * Change: mp-consumer-registry (RED until apply).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as core from "@bapm/core";
import { describe, expect, test } from "vite-plus/test";
import { listFilesRecursive, pickExport, srcRoot } from "./helpers.ts";

function readText(rel: string): string {
  return readFileSync(join(srcRoot, rel), "utf8");
}

describe("mp-consumer-registry Marketplace FEOD module", () => {
  test("Marketplace is a directory module with index.ts", () => {
    const modDir = join(srcRoot, "modules", "Marketplace");
    expect(existsSync(modDir), "missing modules/Marketplace").toBe(true);
    expect(statSync(modDir).isDirectory()).toBe(true);
    expect(existsSync(join(modDir, "index.ts")), "modules/Marketplace/index.ts").toBe(true);
    const topLevelTs = readdirSync(join(srcRoot, "modules")).filter((n) => n === "Marketplace.ts");
    expect(topLevelTs, "Marketplace must not be a single-file module").toEqual([]);
  });

  test("Marketplace sources MUST NOT import Registry HTTP client", () => {
    const modDir = join(srcRoot, "modules", "Marketplace");
    expect(existsSync(modDir)).toBe(true);
    const files = listFilesRecursive(modDir).filter((f) => f.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const body = readFileSync(file, "utf8");
      expect(body, file).not.toMatch(/modules\/Registry/);
      expect(body, file).not.toMatch(/createRegistryClient|BAPM_EXPERIMENTAL_REGISTRIES/);
      expect(body, file).not.toMatch(/from\s+["']@\/modules\/Registry/);
    }
  });

  test("publicApi re-exports Marketplace symbols from package entry", () => {
    const publicApi = readText("app/publicApi.ts");
    expect(publicApi).toMatch(/Marketplace/);
    // Soft resolve a few MUST exports so apply cannot skip the barrel.
    pickExport(["parseMarketplaceJson", "parse_marketplace_json"], "parse export");
    pickExport(
      ["listMarketplaces", "getRegisteredMarketplaces", "listRegisteredMarketplaces"],
      "list export",
    );
    pickExport(["fetchMarketplace", "fetch_marketplace"], "fetch export");
    pickExport(["validateMarketplace", "validate_marketplace"], "validate export");
    const c = core as Record<string, unknown>;
    expect(
      "parseMarketplaceJson" in c ||
        "parse_marketplace_json" in c ||
        typeof c.parseMarketplaceJson === "function",
    ).toBe(true);
  });
});
