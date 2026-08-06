/**
 * FEOD / public API — authoring lives under Marketplace; exported via publicApi.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { core, listFilesRecursive, marketplaceSrc, readSrc, srcRoot } from "./authoring-helpers.ts";

describe("mp-authoring-yml core Marketplace authoring layout", () => {
  test("Marketplace module directory exists (authoring stays inside it)", () => {
    expect(existsSync(marketplaceSrc)).toBe(true);
    expect(statSync(marketplaceSrc).isDirectory()).toBe(true);
    expect(existsSync(join(marketplaceSrc, "index.ts"))).toBe(true);
  });

  test("no separate top-level MarketplaceAuthoring module beside Marketplace", () => {
    const modules = join(srcRoot, "modules");
    const names = readdirSync(modules);
    expect(names.filter((n) => /^MarketplaceAuthoring/i.test(n))).toEqual([]);
    expect(names.filter((n) => /^Authoring$/i.test(n))).toEqual([]);
  });

  test("authoring helper sources exist under Marketplace (Authoring/ or authoring*.ts)", () => {
    const files = listFilesRecursive(marketplaceSrc).filter((f) => f.endsWith(".ts"));
    const authoringFiles = files.filter(
      (f) => /authoring/i.test(f) || /\/Authoring\//.test(f) || /yml_schema|yml_editor|init_template/i.test(f),
    );
    expect(
      authoringFiles.length,
      "expected authoring sources under modules/Marketplace (Authoring/ or authoring*.ts)",
    ).toBeGreaterThan(0);
  });

  test("publicApi + Marketplace index export authoring loaders", () => {
    const publicApi = readSrc("app/publicApi.ts");
    const index = readFileSync(join(marketplaceSrc, "index.ts"), "utf8");
    const surface = `${publicApi}\n${index}`;
    expect(surface).toMatch(/loadMarketplaceFromBapmYml|loadMarketplaceAuthoring|Authoring/);
    expect(surface).toMatch(/detectAuthoringConfigSource|detectMarketplaceAuthoring/);
  });

  test("@bapm/core exports authoring entry points", () => {
    const c = core as Record<string, unknown>;
    const hasLoad = [
      "loadMarketplaceFromBapmYml",
      "loadMarketplaceAuthoringFromBapmYml",
      "loadAuthoringMarketplace",
    ].some((n) => typeof c[n] === "function");
    const hasDetect = [
      "detectAuthoringConfigSource",
      "detectMarketplaceAuthoringSource",
      "detectMarketplaceConfigSource",
    ].some((n) => typeof c[n] === "function");
    expect(hasLoad, "missing loadMarketplaceFromBapmYml (or alias) export").toBe(true);
    expect(hasDetect, "missing detectAuthoringConfigSource (or alias) export").toBe(true);
  });

  test("authoring sources do not write host marketplace.json paths", () => {
    const files = listFilesRecursive(marketplaceSrc).filter((f) => f.endsWith(".ts"));
    const authoringFiles = files.filter(
      (f) => /authoring/i.test(f) || /\/Authoring\//.test(f) || /yml_|init_template|migrate/i.test(f),
    );
    expect(authoringFiles.length).toBeGreaterThan(0);
    for (const file of authoringFiles) {
      const body = readFileSync(file, "utf8");
      // Allow comments / strings documenting deferral, but forbid write of host artifact paths.
      expect(body, file).not.toMatch(
        /writeFileSync\([^)]*\.claude-plugin\/marketplace\.json/,
      );
      expect(body, file).not.toMatch(
        /writeFileSync\([^)]*\.agents\/plugins\/marketplace\.json/,
      );
    }
  });
});
