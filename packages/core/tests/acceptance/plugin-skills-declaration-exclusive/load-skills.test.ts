/**
 * plugin.json `skills` parse/retain — not an unknown field; shape fail-closed.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  AgentPluginsError,
  loadAgentPluginManifest,
  validateAgentPluginManifest,
} from "@b-apm/core";
import {
  AGENT_PLUGIN_SCHEMA,
  cleanupRoot,
  createPluginRoot,
  diagnosticCodes,
  expectThrowsMatching,
  manifestSkills,
  writePluginJson,
  writeSkill,
} from "./helpers.ts";

describe("plugin.json skills key — load and validate", () => {
  let root: string | undefined;

  afterEach(() => {
    cleanupRoot(root);
    root = undefined;
  });

  test("present well-typed skills is retained without AGENT_PLUGIN_UNKNOWN_FIELD", () => {
    root = createPluginRoot();
    writePluginJson(root, { skills: ["hello", "skills/keep"] });
    writeSkill(root, "hello");
    writeSkill(root, "keep");

    const loaded = loadAgentPluginManifest({ root });

    expect(manifestSkills(loaded.manifest)).toEqual(["hello", "skills/keep"]);
    expect(diagnosticCodes(loaded.diagnostics)).not.toContain("AGENT_PLUGIN_UNKNOWN_FIELD");
    expect(
      loaded.diagnostics.some(
        (d) => d.code === "AGENT_PLUGIN_UNKNOWN_FIELD" && /skills/i.test(d.message),
      ),
    ).toBe(false);
  });

  test("empty skills array is retained (exclusive zero), not unknown-field", () => {
    root = createPluginRoot();
    writePluginJson(root, { skills: [] });

    const loaded = loadAgentPluginManifest({ root });

    expect(manifestSkills(loaded.manifest)).toEqual([]);
    expect(
      loaded.diagnostics.some(
        (d) => d.code === "AGENT_PLUGIN_UNKNOWN_FIELD" && /["']skills["']/i.test(d.message),
      ),
    ).toBe(false);
  });

  test("omitted skills leaves manifest.skills undefined", () => {
    root = createPluginRoot();
    writePluginJson(root, {});

    const loaded = loadAgentPluginManifest({ root });

    expect(manifestSkills(loaded.manifest)).toBeUndefined();
  });

  test.each([
    { label: "string", skills: "hello" },
    { label: "object", skills: { hello: true } },
  ])("non-array skills rejected ($label)", ({ skills }) => {
    expectThrowsMatching(
      () =>
        validateAgentPluginManifest({
          $schema: AGENT_PLUGIN_SCHEMA,
          name: "bad-skills-shape",
          skills,
        }),
      /skills|array|string/i,
    );
  });

  test.each([{ skills: [1] }, { skills: [null] }, { skills: [true] }])(
    "non-string skills element rejected (%j)",
    ({ skills }) => {
      expect(() =>
        validateAgentPluginManifest({
          $schema: AGENT_PLUGIN_SCHEMA,
          name: "bad-skills-elem",
          skills,
        }),
      ).toThrow(AgentPluginsError);
    },
  );

  test("empty-string skills element rejected", () => {
    expectThrowsMatching(
      () =>
        validateAgentPluginManifest({
          $schema: AGENT_PLUGIN_SCHEMA,
          name: "empty-skill-name",
          skills: [""],
        }),
      /skills|empty|non-empty/i,
    );
  });
});
