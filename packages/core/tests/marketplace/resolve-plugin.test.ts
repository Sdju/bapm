/**
 * G2 / G8 / G10 — resolveMarketplacePlugin + clear miss/fetch/unsupported errors
 */
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  asRecord,
  concreteDepOf,
  createTempConfigDir,
  expectAsyncThrowMatching,
  getResolveMarketplacePlugin,
  provenanceOf,
  registerLocalMarketplace,
  writeGithubShapedMarketplace,
  writeLocalMarketplaceTree,
  writeRegistryOnlyMarketplace,
  writeUnsupportedHostMarketplace,
  type TempConfig,
} from "./search-install-helpers.ts";

describe("mp-search-install G2/G8/G10 resolveMarketplacePlugin", () => {
  let tmp: TempConfig | undefined;

  afterEach(() => {
    tmp?.cleanup();
    tmp = undefined;
  });

  test("local relative plugin resolves to concrete local dep + provenance", async () => {
    tmp = createTempConfigDir();
    const { marketplaceRoot } = writeLocalMarketplaceTree(tmp.root, {
      marketplaceName: "local-mp",
      pluginName: "demo",
    });
    registerLocalMarketplace("local-mp", marketplaceRoot, { configDir: tmp.configDir });

    const resolve = getResolveMarketplacePlugin();
    const resolution = await Promise.resolve(
      resolve("demo", "local-mp", null, { configDir: tmp.configDir }),
    );
    const dep = concreteDepOf(resolution);
    const depRec = typeof dep === "string" ? { spec: dep } : asRecord(dep);
    const haystack = JSON.stringify(depRec).toLowerCase();
    expect(haystack).toMatch(/demo|plugins/);
    expect(haystack).toMatch(/local|path|\.\//);

    const prov = provenanceOf(resolution);
    expect(String(prov.discovered_via)).toMatch(/^local-mp$/i);
    expect(String(prov.marketplace_plugin_name)).toMatch(/^demo$/i);
  });

  test("github-shaped plugin maps to git coordinates + provenance", async () => {
    tmp = createTempConfigDir();
    const { marketplaceRoot } = writeGithubShapedMarketplace(tmp.root, {
      marketplaceName: "gh-mp",
      pluginName: "tools",
    });
    registerLocalMarketplace("gh-mp", marketplaceRoot, { configDir: tmp.configDir });

    const resolve = getResolveMarketplacePlugin();
    const resolution = await Promise.resolve(
      resolve("tools", "gh-mp", null, { configDir: tmp.configDir }),
    );
    const dep = concreteDepOf(resolution);
    const text =
      typeof dep === "string" ? dep : JSON.stringify(asRecord(dep));
    expect(text).toMatch(/acme\/tools|github\.com\/acme\/tools/i);

    const prov = provenanceOf(resolution);
    expect(String(prov.discovered_via)).toMatch(/^gh-mp$/i);
    expect(String(prov.marketplace_plugin_name)).toMatch(/^tools$/i);
  });

  test("unknown marketplace fails with marketplace-not-found (no bare-git fallback)", async () => {
    tmp = createTempConfigDir();
    const resolve = getResolveMarketplacePlugin();
    await expectAsyncThrowMatching(
      () => resolve("demo", "no-such-market", null, { configDir: tmp!.configDir }),
      /marketplace.*not.?found|not.?found.*marketplace|unknown marketplace|no-such-market/i,
    );
  });

  test("unknown plugin fails with plugin-not-found", async () => {
    tmp = createTempConfigDir();
    const { marketplaceRoot } = writeLocalMarketplaceTree(tmp.root, {
      marketplaceName: "local-mp",
      pluginName: "demo",
    });
    registerLocalMarketplace("local-mp", marketplaceRoot, { configDir: tmp.configDir });

    const resolve = getResolveMarketplacePlugin();
    await expectAsyncThrowMatching(
      () => resolve("missing-plugin", "local-mp", null, { configDir: tmp!.configDir }),
      /plugin.*not.?found|not.?found.*plugin|missing-plugin/i,
    );
  });

  test("G10 registry-only plugin fails closed / deferred (no Registry HTTP)", async () => {
    tmp = createTempConfigDir();
    const { marketplaceRoot } = writeRegistryOnlyMarketplace(tmp.root);
    registerLocalMarketplace("reg-mp", marketplaceRoot, { configDir: tmp.configDir });

    const resolve = getResolveMarketplacePlugin();
    let registryHttpCalled = false;
    const prevFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      registryHttpCalled = true;
      throw new Error("Registry HTTP must not be called for G10 deferred plugins");
    }) as typeof fetch;

    try {
      await expectAsyncThrowMatching(
        () => resolve("only-reg", "reg-mp", null, { configDir: tmp!.configDir }),
        /unsupported|deferred|registry.?routed|no installable|not supported/i,
      );
      expect(registryHttpCalled).toBe(false);
    } finally {
      globalThis.fetch = prevFetch;
    }
  });

  test("unsupported host plugin source fails clearly", async () => {
    tmp = createTempConfigDir();
    const { marketplaceRoot } = writeUnsupportedHostMarketplace(tmp.root);
    registerLocalMarketplace("bad-host-mp", marketplaceRoot, { configDir: tmp.configDir });

    const resolve = getResolveMarketplacePlugin();
    await expectAsyncThrowMatching(
      () => resolve("gl-tools", "bad-host-mp", null, { configDir: tmp!.configDir }),
      /unsupported|gitlab|not supported|host/i,
    );
  });

  test("provenance includes source_url/source_digest when present on marketplace", async () => {
    tmp = createTempConfigDir();
    const { marketplaceRoot } = writeLocalMarketplaceTree(tmp.root, {
      marketplaceName: "prov-mp",
      pluginName: "demo",
      sourceUrl: "https://example.com/marketplaces/prov-mp/marketplace.json",
      sourceDigest: "sha256:abc123deadbeef",
    });
    registerLocalMarketplace("prov-mp", marketplaceRoot, { configDir: tmp.configDir });

    const resolve = getResolveMarketplacePlugin();
    const resolution = await Promise.resolve(
      resolve("demo", "prov-mp", null, { configDir: tmp.configDir }),
    );
    const prov = provenanceOf(resolution);
    expect(String(prov.source_url)).toMatch(/prov-mp|example\.com/);
    expect(String(prov.source_digest)).toMatch(/sha256:abc123deadbeef|abc123deadbeef/);
  });

  test("resolve does not invent path under missing marketplace alias", async () => {
    tmp = createTempConfigDir();
    // Ensure config dir exists but empty registry
    writeLocalMarketplaceTree(tmp.root, { marketplaceName: "orphan" });
    const resolve = getResolveMarketplacePlugin();
    await expectAsyncThrowMatching(
      () => resolve("orphan", "orphan", null, { configDir: join(tmp!.configDir) }),
      /marketplace.*not.?found|not.?found|unknown marketplace/i,
    );
  });
});
