/**
 * marketplace-fetch-cache — local/url/github dispatch, TTL, security.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  FIXTURE_CLAUDE_OK,
  createTempConfigDir,
  getCreateMarketplaceSource,
  getFetchApi,
  getPathHelpers,
  pluginNames,
  writeLocalMarketplaceDir,
  type TempConfig,
} from "./helpers.ts";

async function callFetch(
  fetchFn: (source: unknown, opts?: Record<string, unknown>) => Promise<unknown> | unknown,
  source: unknown,
  opts?: Record<string, unknown>,
): Promise<unknown> {
  return await Promise.resolve(fetchFn(source, opts));
}

describe("mp-consumer-registry fetch + cache", () => {
  let tmp: TempConfig | undefined;

  afterEach(() => {
    tmp?.cleanup();
    tmp = undefined;
  });

  test("local directory auto-detects .claude-plugin/marketplace.json candidate", async () => {
    tmp = createTempConfigDir();
    const root = join(tmp.configDir, "repo");
    writeLocalMarketplaceDir(root, ".claude-plugin/marketplace.json", FIXTURE_CLAUDE_OK);
    const create = getCreateMarketplaceSource();
    const { fetch } = getFetchApi();
    const source = create({ name: "local-mp", url: root, path: "" });
    const manifest = await callFetch(fetch, source, { configDir: tmp.configDir });
    expect(pluginNames(manifest)).toContain("hello-skill");
  });

  test("unsupported gitlab/ado/git kinds are refused without network", async () => {
    const create = getCreateMarketplaceSource();
    const { fetch } = getFetchApi();
    const gitlab = create({
      name: "gl",
      url: "https://gitlab.com/acme/tools.git",
    });
    await expect(callFetch(fetch, gitlab, { fetch: async () => {
      throw new Error("network must not be called for unsupported kinds");
    } })).rejects.toThrow(/gitlab|unsupported|not supported|out of scope/i);
  });

  test("HTTP marketplace.json URL is rejected before body download", async () => {
    const create = getCreateMarketplaceSource();
    const { fetch } = getFetchApi();
    let fetched = false;
    const source = create({
      name: "http-mp",
      url: "http://example.com/path/marketplace.json",
      path: "",
    });
    await expect(
      callFetch(fetch, source, {
        fetch: async () => {
          fetched = true;
          return new Response("{}", { status: 200 });
        },
      }),
    ).rejects.toThrow(/https|insecure|http/i);
    expect(fetched).toBe(false);
  });

  test("unsafe ref is rejected", async () => {
    const create = getCreateMarketplaceSource();
    const { fetch } = getFetchApi();
    const source = create({
      name: "bad-ref",
      owner: "acme",
      repo: "tools",
      ref: "-evil;rm",
    });
    await expect(callFetch(fetch, source)).rejects.toThrow(/ref|invalid/i);
  });

  test("url fetch uses injectable transport and caches under cache/marketplace", async () => {
    tmp = createTempConfigDir();
    const create = getCreateMarketplaceSource();
    const paths = getPathHelpers();
    const { fetch } = getFetchApi();
    let hits = 0;
    const transport = async (input: RequestInfo | URL) => {
      hits += 1;
      const href = String(input);
      expect(href).toBe("https://example.com/path/marketplace.json");
      return new Response(FIXTURE_CLAUDE_OK, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const source = create({
      name: "url-mp",
      url: "https://example.com/path/marketplace.json",
      path: "",
    });
    const opts = { configDir: tmp.configDir, fetch: transport, forceRefresh: true };
    const first = await callFetch(fetch, source, opts);
    expect(pluginNames(first)).toContain("hello-skill");
    expect(hits).toBe(1);

    const second = await callFetch(fetch, source, {
      configDir: tmp.configDir,
      fetch: transport,
      forceRefresh: false,
    });
    expect(pluginNames(second)).toContain("hello-skill");
    expect(hits).toBe(1);

    const cacheDir = paths.marketplaceCacheDir({ configDir: tmp.configDir });
    expect(existsSync(cacheDir)).toBe(true);
    const cacheFiles = readdirSync(cacheDir);
    expect(cacheFiles.some((f) => f.endsWith(".json"))).toBe(true);
  });

  test("force refresh bypasses TTL and clear removes sidecars", async () => {
    tmp = createTempConfigDir();
    const create = getCreateMarketplaceSource();
    const paths = getPathHelpers();
    const { fetch, clearCache } = getFetchApi();
    let hits = 0;
    const transport = async () => {
      hits += 1;
      return new Response(FIXTURE_CLAUDE_OK, { status: 200 });
    };
    const source = create({
      name: "url-mp",
      url: "https://example.com/other/marketplace.json",
      path: "",
    });
    const base = { configDir: tmp.configDir, fetch: transport };
    await callFetch(fetch, source, { ...base, forceRefresh: true });
    await callFetch(fetch, source, { ...base, forceRefresh: true });
    expect(hits).toBe(2);

    clearCache(source, { configDir: tmp.configDir });
    const cacheDir = paths.marketplaceCacheDir({ configDir: tmp.configDir });
    const remaining = existsSync(cacheDir)
      ? readdirSync(cacheDir).filter((n) => n !== "." && n !== "..")
      : [];
    expect(remaining).toEqual([]);
  });

  test("oversized body is rejected (~10 MiB)", async () => {
    const create = getCreateMarketplaceSource();
    const { fetch } = getFetchApi();
    const big = "x".repeat(10 * 1024 * 1024 + 64);
    const source = create({
      name: "huge",
      url: "https://example.com/huge/marketplace.json",
      path: "",
    });
    await expect(
      callFetch(fetch, source, {
        forceRefresh: true,
        fetch: async () =>
          new Response(big, {
            status: 200,
            headers: { "content-length": String(big.length) },
          }),
      }),
    ).rejects.toThrow(/size|limit|too large|10\s*mi?b|10485760/i);
  });

  test("direct url does not append git-backed candidate paths", async () => {
    const create = getCreateMarketplaceSource();
    const { fetch } = getFetchApi();
    const requested: string[] = [];
    const source = create({
      name: "url-only",
      url: "https://example.com/path/marketplace.json",
      path: "",
    });
    await callFetch(fetch, source, {
      forceRefresh: true,
      fetch: async (input: RequestInfo | URL) => {
        requested.push(String(input));
        return new Response(FIXTURE_CLAUDE_OK, { status: 200 });
      },
    });
    expect(requested).toEqual(["https://example.com/path/marketplace.json"]);
    expect(requested.some((u) => u.includes(".github/plugin"))).toBe(false);
  });
});
