import { describe, expect, test } from "vite-plus/test";
import {
  createMarketplaceSource,
  parseMarketplaceJson,
  urlNamesRemoteManifest,
} from "@/modules/Marketplace";

const COPILOT = `{
  "name": "copilot-mp",
  "plugins": [
    { "name": "tools", "description": "Tools", "repository": "acme/tools", "ref": "main" }
  ]
}`;

const WITH_NPM = `{
  "name": "mixed-mp",
  "plugins": [
    { "name": "keep-me", "source": "./keep" },
    { "name": "npm-skip", "source": { "source": "npm", "package": "@acme/pkg" } }
  ]
}`;

const BAD_REGISTRY = `{
  "name": "bad-reg",
  "plugins": [
    { "name": "broken", "source": "./x", "registry": 42 }
  ]
}`;

describe("Marketplace models + parse", () => {
  test("OWNER/REPO synthesizes github kind", () => {
    const source = createMarketplaceSource({ name: "acme-tools", owner: "acme", repo: "tools" });
    expect(source.kind).toBe("github");
    expect(source.url).toMatch(/https:\/\/github\.com\/acme\/tools/i);
  });

  test("urlNamesRemoteManifest + url kind", () => {
    const url = "https://example.com/path/marketplace.json";
    expect(urlNamesRemoteManifest(url)).toBe(true);
    const source = createMarketplaceSource({ name: "remote-mp", url, path: "" });
    expect(source.kind).toBe("url");
  });

  test("Copilot repository parses; npm skipped; bad registry fails", () => {
    const copilot = parseMarketplaceJson(COPILOT);
    expect(copilot.findPlugin("TOOLS")?.name).toBe("tools");
    const src = copilot.plugins[0]?.source as { type?: string; repo?: string };
    expect(src?.type).toBe("github");
    expect(src?.repo).toBe("acme/tools");

    const mixed = parseMarketplaceJson(WITH_NPM);
    expect(mixed.plugins.map((p) => p.name)).toEqual(["keep-me"]);

    expect(() => parseMarketplaceJson(BAD_REGISTRY)).toThrow(/registry|string/i);
  });
});
