/**
 * marketplace-local-registry — ~/.bapm paths + CRUD.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  asRecord,
  createTempConfigDir,
  getCreateMarketplaceSource,
  getPathHelpers,
  getRegistryApi,
  sourceKind,
  type TempConfig,
} from "./helpers.ts";

describe("mp-consumer-registry local registry CRUD", () => {
  let tmp: TempConfig | undefined;

  afterEach(() => {
    tmp?.cleanup();
    tmp = undefined;
  });

  test("paths resolve under configDir /.bapm layout and never ~/.apm", () => {
    tmp = createTempConfigDir();
    const paths = getPathHelpers();
    const configDir = paths.ensureBapmConfigDir({ configDir: tmp.configDir });
    expect(configDir).toContain(tmp.configDir);
    const jsonPath = paths.marketplacesJsonPath({ configDir: tmp.configDir });
    const cacheDir = paths.marketplaceCacheDir({ configDir: tmp.configDir });
    expect(jsonPath).toMatch(/marketplaces\.json$/);
    expect(jsonPath).toContain(tmp.configDir);
    expect(cacheDir).toMatch(/cache[/\\]marketplace/);
    expect(jsonPath).not.toMatch(/\.apm/);
    expect(cacheDir).not.toMatch(/\.apm/);
    expect(paths.getBapmConfigDir({ configDir: tmp.configDir })).not.toMatch(/\.apm[/\\]?$/);
  });

  test("load bootstraps empty marketplaces.json skeleton", () => {
    tmp = createTempConfigDir();
    const paths = getPathHelpers();
    const registry = getRegistryApi();
    const listed = registry.list({ configDir: tmp.configDir });
    expect(Array.isArray(listed)).toBe(true);
    expect(listed).toEqual([]);
    const jsonPath = paths.marketplacesJsonPath({ configDir: tmp.configDir });
    expect(existsSync(jsonPath)).toBe(true);
    const body = JSON.parse(readFileSync(jsonPath, "utf8")) as { marketplaces?: unknown };
    expect(Array.isArray(body.marketplaces)).toBe(true);
    expect(body.marketplaces).toEqual([]);
  });

  test("add replaces same name case-insensitively", () => {
    tmp = createTempConfigDir();
    const create = getCreateMarketplaceSource();
    const registry = getRegistryApi();
    const opts = { configDir: tmp.configDir };

    const first = create({
      name: "Acme",
      url: join(tmp.configDir, "first.json"),
    });
    const second = create({
      name: "acme",
      url: join(tmp.configDir, "second.json"),
    });
    expect(sourceKind(first)).toBe("local");
    registry.add(first, opts);
    registry.add(second, opts);

    const listed = registry.list(opts);
    expect(listed).toHaveLength(1);
    const entry = asRecord(listed[0]);
    expect(String(entry.name)).toMatch(/^acme$/i);
    expect(String(entry.url)).toContain("second.json");
  });

  test("remove missing name fails with not-found and leaves file unchanged", () => {
    tmp = createTempConfigDir();
    const create = getCreateMarketplaceSource();
    const registry = getRegistryApi();
    const paths = getPathHelpers();
    const opts = { configDir: tmp.configDir };

    registry.add(create({ name: "keep", url: join(tmp.configDir, "keep.json") }), opts);
    const before = readFileSync(paths.marketplacesJsonPath(opts), "utf8");

    expect(() => registry.remove("missing-mp", opts)).toThrow(/not.?found|unknown|missing/i);

    const after = readFileSync(paths.marketplacesJsonPath(opts), "utf8");
    expect(after).toBe(before);
    expect(registry.list(opts)).toHaveLength(1);
  });

  test("get by name is case-insensitive", () => {
    tmp = createTempConfigDir();
    const create = getCreateMarketplaceSource();
    const registry = getRegistryApi();
    const opts = { configDir: tmp.configDir };
    registry.add(create({ name: "Demo", url: join(tmp.configDir, "demo.json") }), opts);
    const hit = asRecord(registry.get("demo", opts));
    expect(String(hit.name)).toMatch(/^demo$/i);
  });
});
