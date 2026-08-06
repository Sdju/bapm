/**
 * Acceptance: marketplace-models — Source kinds + parseMarketplaceJson.
 * Change: mp-consumer-registry (RED until apply).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  FIXTURE_BAD_REGISTRY,
  FIXTURE_COPILOT,
  FIXTURE_WITH_NPM,
  asRecord,
  createTempConfigDir,
  findPluginByName,
  getCreateMarketplaceSource,
  getParseMarketplaceJson,
  getUrlNamesRemoteManifest,
  pluginNames,
  sourceKind,
  type TempConfig,
} from "./helpers.ts";

describe("mp-consumer-registry models + parse", () => {
  let tmp: TempConfig | undefined;

  afterEach(() => {
    tmp?.cleanup();
    tmp = undefined;
  });

  test("OWNER/REPO synthesizes github kind", () => {
    const create = getCreateMarketplaceSource();
    // Prefer kwargs-style; fall back to positional / from-dict if needed.
    let source: Record<string, unknown>;
    try {
      source = create({ name: "acme-tools", owner: "acme", repo: "tools" });
    } catch {
      source = create("acme-tools", { owner: "acme", repo: "tools" });
    }
    expect(sourceKind(source)).toBe("github");
    const url = String(source.url ?? "");
    expect(url).toMatch(/https:\/\/github\.com\/acme\/tools/i);
  });

  test("direct marketplace.json HTTPS URL is kind url", () => {
    const create = getCreateMarketplaceSource();
    const url = "https://example.com/path/marketplace.json";
    const source = create({ name: "remote-mp", url, path: "" });
    expect(sourceKind(source)).toBe("url");
    expect(getUrlNamesRemoteManifest()(url)).toBe(true);
  });

  test("local path or file:// is kind local", () => {
    tmp = createTempConfigDir();
    const create = getCreateMarketplaceSource();
    const fileSource = create({ name: "local-file", url: `${tmp.configDir}/marketplace.json` });
    expect(sourceKind(fileSource)).toBe("local");
    const uriSource = create({ name: "local-uri", url: `file://${tmp.configDir}/marketplace.json` });
    expect(sourceKind(uriSource)).toBe("local");
  });

  test("Copilot repository entry parses to github-typed plugin source", () => {
    const parse = getParseMarketplaceJson();
    const manifest = parse(FIXTURE_COPILOT);
    const names = pluginNames(manifest);
    expect(names).toContain("tools");
    const plugin = asRecord(findPluginByName(manifest, "tools"));
    const src = plugin.source;
    expect(src).toBeTruthy();
    if (typeof src === "string") {
      expect(src).toMatch(/acme\/tools/);
    } else {
      const obj = asRecord(src);
      const blob = JSON.stringify(obj);
      expect(blob).toMatch(/acme\/tools|github/i);
    }
  });

  test("Claude npm source is skipped without failing the document", () => {
    const parse = getParseMarketplaceJson();
    const manifest = parse(FIXTURE_WITH_NPM);
    const names = pluginNames(manifest);
    expect(names).toContain("keep-me");
    expect(names).not.toContain("npm-skip");
  });

  test("malformed registry field fails closed", () => {
    const parse = getParseMarketplaceJson();
    expect(() => parse(FIXTURE_BAD_REGISTRY)).toThrow(/registry|valid|string/i);
  });

  test("find plugin by name is case-insensitive", () => {
    const parse = getParseMarketplaceJson();
    const manifest = parse(FIXTURE_COPILOT);
    const hit = findPluginByName(manifest, "TOOLS");
    expect(asRecord(hit).name).toMatch(/^tools$/i);
  });
});
