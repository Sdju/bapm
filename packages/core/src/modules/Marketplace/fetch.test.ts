import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  clearMarketplaceCache,
  createMarketplaceSource,
  fetchMarketplace,
  validateMarketplace,
  parseMarketplaceJson,
} from "@/modules/Marketplace";

const FIXTURE = `{
  "name": "demo-mp",
  "plugins": [
    { "name": "hello-skill", "description": "Hello", "source": "./plugins/hello", "version": "1.0.0" }
  ]
}`;

describe("Marketplace fetch + validate", () => {
  let configDir: string | undefined;

  afterEach(() => {
    if (configDir) rmSync(configDir, { recursive: true, force: true });
    configDir = undefined;
  });

  test("local dir auto-detect; url cache; refuse generic git; validate dups", async () => {
    configDir = mkdtempSync(join(tmpdir(), "bapm-mp-fetch-"));
    const root = join(configDir, "repo");
    const file = join(root, ".claude-plugin", "marketplace.json");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, FIXTURE, "utf8");

    const local = createMarketplaceSource({ name: "local-mp", url: root, path: "" });
    const manifest = await fetchMarketplace(local, { configDir });
    expect(manifest.plugins.map((p) => p.name)).toContain("hello-skill");

    const generic = createMarketplaceSource({
      name: "generic-git",
      url: "https://git.example.invalid/acme/tools.git",
    });
    await expect(
      fetchMarketplace(generic, {
        fetch: async () => {
          throw new Error("network must not be called");
        },
      }),
    ).rejects.toThrow(/git|unsupported|not supported|out of scope/i);

    let hits = 0;
    const urlSource = createMarketplaceSource({
      name: "url-mp",
      url: "https://example.com/path/marketplace.json",
      path: "",
    });
    const transport = async () => {
      hits += 1;
      return new Response(FIXTURE, { status: 200 });
    };
    await fetchMarketplace(urlSource, { configDir, fetch: transport, forceRefresh: true });
    await fetchMarketplace(urlSource, { configDir, fetch: transport, forceRefresh: false });
    expect(hits).toBe(1);
    clearMarketplaceCache(urlSource, { configDir });

    const badRef = createMarketplaceSource({
      name: "bad-ref",
      owner: "acme",
      repo: "tools",
      ref: "-evil;rm",
    });
    await expect(fetchMarketplace(badRef)).rejects.toThrow(/ref|invalid/i);

    const dup = parseMarketplaceJson(`{
      "name": "dup",
      "plugins": [
        { "name": "Foo", "source": "./a" },
        { "name": "foo", "source": "./b" }
      ]
    }`);
    const results = validateMarketplace(dup);
    expect(results.some((r) => !r.passed)).toBe(true);
    expect(JSON.stringify(results)).toMatch(/duplicate/i);
  });
});
