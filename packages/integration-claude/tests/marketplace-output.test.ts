import { expect, test } from "vite-plus/test";
import { claudeMarketplaceIntegration, mapClaudeMarketplace } from "../src/index.ts";

test("provides Claude marketplace output with its default path", () => {
  expect(claudeMarketplaceIntegration).toMatchObject({
    id: "claude",
    marketplaceOutput: {
      format: "claude",
      defaultOutput: ".claude-plugin/marketplace.json",
    },
  });
});

test("maps local packages to Claude marketplace plugins", () => {
  expect(
    mapClaudeMarketplace({ name: "Example marketplace", owner: "Bapm" }, [
      {
        name: "example-plugin",
        entry: { description: "Example plugin", version: "1.0.0" },
        isLocal: true,
        source: "./plugins/example-plugin",
      },
    ]),
  ).toMatchObject({
    name: "Example marketplace",
    owner: { name: "Bapm" },
    plugins: [
      {
        name: "example-plugin",
        source: "./plugins/example-plugin",
      },
    ],
  });
});
