import { expect, test } from "vite-plus/test";
import { codexMarketplaceIntegration, mapCodexMarketplace } from "../src/index.ts";

test("provides Codex marketplace output with its default path", () => {
  expect(codexMarketplaceIntegration).toMatchObject({
    id: "codex",
    marketplaceOutput: {
      format: "codex",
      defaultOutput: ".agents/plugins/marketplace.json",
    },
  });
});

test("requires a category while mapping Codex marketplace plugins", () => {
  expect(() =>
    mapCodexMarketplace({ name: "Example marketplace" }, [
      { name: "example-plugin", entry: {}, isLocal: true, source: "./plugins/example-plugin" },
    ]),
  ).toThrow(/category required for Codex output/);

  expect(
    mapCodexMarketplace({ name: "Example marketplace" }, [
      {
        name: "example-plugin",
        entry: { category: "development" },
        isLocal: true,
        source: "./plugins/example-plugin",
      },
    ]),
  ).toMatchObject({
    name: "Example marketplace",
    plugins: [{ name: "example-plugin", category: "development" }],
  });
});
