import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  addMarketplace,
  createMarketplaceSource,
  getMarketplace,
  listMarketplaces,
  marketplacesJsonPath,
  removeMarketplace,
} from "@/modules/Marketplace";

describe("Marketplace registry CRUD", () => {
  let configDir: string | undefined;

  afterEach(() => {
    if (configDir) rmSync(configDir, { recursive: true, force: true });
    configDir = undefined;
  });

  test("empty bootstrap, add-replace, get, remove missing", () => {
    configDir = mkdtempSync(join(tmpdir(), "bapm-mp-reg-"));
    const opts = { configDir };
    expect(listMarketplaces(opts)).toEqual([]);
    const body = JSON.parse(readFileSync(marketplacesJsonPath(opts), "utf8")) as {
      marketplaces: unknown[];
    };
    expect(body.marketplaces).toEqual([]);

    addMarketplace(
      createMarketplaceSource({ name: "Acme", url: join(configDir, "first.json") }),
      opts,
    );
    addMarketplace(
      createMarketplaceSource({ name: "acme", url: join(configDir, "second.json") }),
      opts,
    );
    expect(listMarketplaces(opts)).toHaveLength(1);
    expect(getMarketplace("ACME", opts).url).toContain("second.json");

    const before = readFileSync(marketplacesJsonPath(opts), "utf8");
    expect(() => removeMarketplace("missing-mp", opts)).toThrow(/not.?found/i);
    expect(readFileSync(marketplacesJsonPath(opts), "utf8")).toBe(before);
  });
});
