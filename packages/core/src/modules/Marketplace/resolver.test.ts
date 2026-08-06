import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  addMarketplace,
  createMarketplaceSource,
  parseMarketplaceRef,
  resolveMarketplacePlugin,
} from "./index.ts";

describe("Marketplace resolver", () => {
  let root: string | undefined;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  test("parseMarketplaceRef matches and rejects semver range", () => {
    expect(parseMarketplaceRef("tools@acme")).toEqual({
      pluginName: "tools",
      marketplaceName: "acme",
      ref: null,
    });
    expect(parseMarketplaceRef("owner/repo#main")).toBeNull();
    expect(() => parseMarketplaceRef("tools@acme#^1.0.0")).toThrow(/semver|range|invalid/i);
  });

  test("resolveMarketplacePlugin local + miss", async () => {
    root = mkdtempSync(join(tmpdir(), "bapm-mp-res-"));
    const configDir = join(root, ".bapm");
    mkdirSync(configDir, { recursive: true });
    const mpRoot = join(root, "mp");
    mkdirSync(join(mpRoot, "plugins", "demo"), { recursive: true });
    writeFileSync(
      join(mpRoot, "marketplace.json"),
      JSON.stringify({
        name: "local-mp",
        plugins: [{ name: "demo", source: "./plugins/demo", description: "d" }],
      }),
    );
    writeFileSync(join(mpRoot, "plugins", "demo", "apm.yml"), "name: demo\nversion: 1.0.0\n");
    addMarketplace(createMarketplaceSource({ name: "local-mp", url: mpRoot }), { configDir });

    const ok = await resolveMarketplacePlugin("demo", "local-mp", null, { configDir });
    expect(ok.provenance().discovered_via).toBe("local-mp");
    expect(JSON.stringify(ok.dependency)).toMatch(/demo/);

    await expect(resolveMarketplacePlugin("nope", "local-mp", null, { configDir })).rejects.toThrow(
      /not found/i,
    );
  });
});
