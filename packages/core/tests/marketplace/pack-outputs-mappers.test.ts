/**
 * Unit: Claude/Codex mappers (happy path; Codex missing category fails).
 */
import { describe, expect, test } from "vite-plus/test";
import * as core from "@bapm/core";
import { mapClaudeMarketplace } from "bapm-integration-claude";
import { mapCodexMarketplace } from "bapm-integration-codex";

describe("mp-pack-outputs unit mappers", () => {
  const serialize = (core as Record<string, unknown>).serializeMarketplaceJson as
    | ((doc: Record<string, unknown>) => string)
    | undefined;

  test("Claude mapper emits plugins with local path source and strips APM-only keys", () => {
    const entry = {
      name: "demo",
      source: "./plugins/demo",
      isLocal: true,
      is_local: true,
      tag_pattern: "v*",
      include_prerelease: true,
    };
    const doc = mapClaudeMarketplace({ name: "acme-mp", owner: "acme-org", packages: [entry] }, [
      {
        name: "demo",
        source: "./plugins/demo",
        sourceRepo: "./plugins/demo",
        isLocal: true,
        isPrerelease: false,
        tags: [],
        entry,
      },
    ]);
    expect(doc.name).toBe("acme-mp");
    const plugins = doc.plugins as Record<string, unknown>[];
    expect(plugins[0]?.source).toMatch(/plugins\/demo/);
    expect(plugins[0]).not.toHaveProperty("tag_pattern");
    expect(plugins[0]).not.toHaveProperty("include_prerelease");
    expect(plugins[0]).not.toHaveProperty("isLocal");
  });

  test("Codex mapper requires category and emits policy", () => {
    const entry = {
      name: "demo",
      source: "./plugins/demo",
      isLocal: true,
      is_local: true,
      category: "tools",
    };
    const doc = mapCodexMarketplace({ name: "codex-mp", owner: "acme", packages: [entry] }, [
      {
        name: "demo",
        source: "./plugins/demo",
        sourceRepo: "./plugins/demo",
        isLocal: true,
        isPrerelease: false,
        tags: [],
        entry,
      },
    ]);
    expect((doc.interface as { displayName: string }).displayName).toBe("codex-mp");
    const plugins = doc.plugins as Record<string, unknown>[];
    expect(plugins[0]?.category).toBe("tools");
    expect(plugins[0]).toHaveProperty("policy");
    expect(plugins[0]).toHaveProperty("source");
  });

  test("Codex mapper fails closed without category", () => {
    const entry = {
      name: "demo",
      source: "./plugins/demo",
      isLocal: true,
      is_local: true,
    };
    expect(() =>
      mapCodexMarketplace({ name: "codex-mp", packages: [entry] }, [
        {
          name: "demo",
          source: "./plugins/demo",
          sourceRepo: "./plugins/demo",
          isLocal: true,
          isPrerelease: false,
          tags: [],
          entry,
        },
      ]),
    ).toThrow(/categor/i);
  });

  test("serializeMarketplaceJson uses indent 2 + trailing newline", () => {
    expect(serialize).toBeTypeOf("function");
    const raw = serialize!({ name: "x", plugins: [] });
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw).toMatch(/\n {2}"/);
  });
});
