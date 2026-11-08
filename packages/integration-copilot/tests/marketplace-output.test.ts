import { expect, test } from "vite-plus/test";
import {
  copilotMarketplaceIntegration,
  mapCopilotMarketplace,
  sanitizeCopilotMarketplaceName,
} from "../src/index.ts";

const FULL_SHA = "0123456789abcdef0123456789abcdef01234567";

test("provides Copilot marketplace output with its default path", () => {
  expect(copilotMarketplaceIntegration).toMatchObject({
    id: "copilot",
    marketplaceOutput: {
      format: "copilot",
      defaultOutput: ".github/plugin/marketplace.json",
    },
  });
});

test("maps local packages to Copilot marketplace plugins with nested metadata", () => {
  expect(
    mapCopilotMarketplace(
      {
        name: "Example.Marketplace",
        owner: { name: "Acme", email: "dev@example.com", url: "https://example.com" },
        description: "Example marketplace",
        version: "1.2.3",
      },
      [
        {
          name: "example-plugin",
          entry: { description: "Example plugin", version: "1.0.0", tags: ["ignored"] },
          isLocal: true,
          source: "./plugins/example-plugin",
        },
      ],
    ),
  ).toEqual({
    name: "example-marketplace",
    owner: { name: "Acme", email: "dev@example.com" },
    metadata: { description: "Example marketplace", version: "1.2.3" },
    plugins: [
      {
        name: "example-plugin",
        description: "Example plugin",
        version: "1.0.0",
        source: "./plugins/example-plugin",
      },
    ],
  });
});

test("maps GitHub shorthand remotes to Copilot github repos with ref/path/sha", () => {
  expect(
    mapCopilotMarketplace({ name: "acme", owner: "Acme" }, [
      {
        name: "tools",
        entry: { version: "^1.0.0" },
        isLocal: false,
        sourceRepo: "acme/tools",
        source: "acme/tools",
        subdir: "plugins/tools",
        ref: "v1.0.0",
        sha: FULL_SHA,
      },
    ]),
  ).toMatchObject({
    plugins: [
      {
        name: "tools",
        source: {
          source: "github",
          repo: "acme/tools",
          path: "plugins/tools",
          ref: "v1.0.0",
          sha: FULL_SHA,
        },
      },
    ],
  });
});

test("maps non-GitHub remotes to Copilot url sources", () => {
  expect(
    mapCopilotMarketplace({ name: "acme", owner: "Acme" }, [
      {
        name: "tools",
        entry: {},
        isLocal: false,
        sourceRepo: "group/tools",
        source: "gitlab.example.com/group/tools",
        host: "gitlab.example.com",
        ref: "main",
        sha: FULL_SHA,
      },
    ]),
  ).toMatchObject({
    plugins: [
      {
        name: "tools",
        source: {
          source: "url",
          url: "https://gitlab.example.com/group/tools",
          ref: "main",
          sha: FULL_SHA,
        },
      },
    ],
  });
});

test("normalizes marketplace names to kebab-case", () => {
  expect(sanitizeCopilotMarketplaceName("My_Package")).toBe("my-package");
  expect(sanitizeCopilotMarketplaceName("---")).toBe("marketplace");
});

test("rejects short commit SHAs for Copilot remotes", () => {
  expect(() =>
    mapCopilotMarketplace({ name: "acme", owner: "Acme" }, [
      {
        name: "tools",
        entry: {},
        isLocal: false,
        sourceRepo: "acme/tools",
        source: "acme/tools",
        ref: "main",
        sha: "abc1234",
      },
    ]),
  ).toThrow(/40-character commit SHA/i);
});
