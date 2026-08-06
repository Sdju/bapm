/**
 * Unit: Claude/Codex mappers (happy path; Codex missing category fails).
 */
import { describe, expect, test } from "vite-plus/test";
import * as core from "@bapm/core";

describe("mp-pack-outputs unit mappers", () => {
  const mapClaude = (core as Record<string, unknown>).mapClaudeMarketplace as
    | ((config: unknown, resolved: unknown[]) => Record<string, unknown>)
    | undefined;
  const mapCodex = (core as Record<string, unknown>).mapCodexMarketplace as
    | ((config: unknown, resolved: unknown[]) => Record<string, unknown>)
    | undefined;
  const serialize = (core as Record<string, unknown>).serializeMarketplaceJson as
    | ((doc: Record<string, unknown>) => string)
    | undefined;

  test("Claude mapper emits plugins with local path source and strips APM-only keys", () => {
    expect(mapClaude).toBeTypeOf("function");
    const entry = {
      name: "demo",
      source: "./plugins/demo",
      isLocal: true,
      is_local: true,
      tag_pattern: "v*",
      include_prerelease: true,
    };
    const doc = mapClaude!(
      { name: "acme-mp", owner: "acme-org", packages: [entry] },
      [
        {
          name: "demo",
          source: "./plugins/demo",
          sourceRepo: "./plugins/demo",
          isLocal: true,
          isPrerelease: false,
          tags: [],
          entry,
        },
      ],
    );
    expect(doc.name).toBe("acme-mp");
    const plugins = doc.plugins as Record<string, unknown>[];
    expect(plugins[0]?.source).toMatch(/plugins\/demo/);
    expect(plugins[0]).not.toHaveProperty("tag_pattern");
    expect(plugins[0]).not.toHaveProperty("include_prerelease");
    expect(plugins[0]).not.toHaveProperty("isLocal");
  });

  test("Codex mapper requires category and emits policy", () => {
    expect(mapCodex).toBeTypeOf("function");
    const entry = {
      name: "demo",
      source: "./plugins/demo",
      isLocal: true,
      is_local: true,
      category: "tools",
    };
    const doc = mapCodex!(
      { name: "codex-mp", owner: "acme", packages: [entry] },
      [
        {
          name: "demo",
          source: "./plugins/demo",
          sourceRepo: "./plugins/demo",
          isLocal: true,
          isPrerelease: false,
          tags: [],
          entry,
        },
      ],
    );
    expect((doc.interface as { displayName: string }).displayName).toBe("codex-mp");
    const plugins = doc.plugins as Record<string, unknown>[];
    expect(plugins[0]?.category).toBe("tools");
    expect(plugins[0]).toHaveProperty("policy");
    expect(plugins[0]).toHaveProperty("source");
  });

  test("Codex mapper fails closed without category", () => {
    expect(mapCodex).toBeTypeOf("function");
    const entry = {
      name: "demo",
      source: "./plugins/demo",
      isLocal: true,
      is_local: true,
    };
    expect(() =>
      mapCodex!(
        { name: "codex-mp", packages: [entry] },
        [
          {
            name: "demo",
            source: "./plugins/demo",
            sourceRepo: "./plugins/demo",
            isLocal: true,
            isPrerelease: false,
            tags: [],
            entry,
          },
        ],
      ),
    ).toThrow(/categor/i);
  });

  test("serializeMarketplaceJson uses indent 2 + trailing newline", () => {
    expect(serialize).toBeTypeOf("function");
    const raw = serialize!({ name: "x", plugins: [] });
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw).toMatch(/\n {2}"/);
  });
});
