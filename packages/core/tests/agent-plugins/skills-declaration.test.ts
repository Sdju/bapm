/**
 * Unit coverage for exclusive plugin.json `skills:` parse + discover.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
  AgentPluginsError,
  discoverAgentPluginSkills,
  loadAgentPluginManifest,
  validateAgentPluginManifest,
} from "@b-apm/core";

let root: string | undefined;

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

function createPlugin(fields: Record<string, unknown> = {}): string {
  root = mkdtempSync(join(tmpdir(), "bapm-skills-decl-"));
  writeFileSync(
    join(root, "plugin.json"),
    JSON.stringify({
      $schema: AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
      name: "skills-decl",
      ...fields,
    }),
    "utf8",
  );
  return root;
}

function writeSkill(pluginRoot: string, name: string): void {
  const dir = join(pluginRoot, "skills", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), `---\nname: ${name}\n---\n`, "utf8");
}

describe("plugin.json skills declaration (unit)", () => {
  test("omit / empty / list parse shapes", () => {
    expect(
      validateAgentPluginManifest({
        $schema: AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
        name: "omit-skills",
      }).manifest.skills,
    ).toBeUndefined();

    expect(
      validateAgentPluginManifest({
        $schema: AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
        name: "empty-skills",
        skills: [],
      }).manifest.skills,
    ).toEqual([]);

    expect(
      validateAgentPluginManifest({
        $schema: AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
        name: "list-skills",
        skills: ["a", "skills/b"],
      }).manifest.skills,
    ).toEqual(["a", "skills/b"]);
  });

  test("malformed skills fail closed; unknown other fields still warn", () => {
    expect(() =>
      validateAgentPluginManifest({
        $schema: AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
        name: "bad",
        skills: "x",
      }),
    ).toThrow(AgentPluginsError);

    expect(() =>
      validateAgentPluginManifest({
        $schema: AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
        name: "bad-obj",
        skills: { hello: true },
      }),
    ).toThrow(AgentPluginsError);

    for (const skills of [[1], [null], [true], [""]] as unknown[][]) {
      expect(() =>
        validateAgentPluginManifest({
          $schema: AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
          name: "bad-elem",
          skills,
        }),
      ).toThrow(AgentPluginsError);
    }

    const loaded = loadAgentPluginManifest({
      root: createPlugin({ skills: ["hello"], futureField: true }),
    });
    writeSkill(root!, "hello");
    expect(loaded.manifest.skills).toEqual(["hello"]);
    expect(loaded.diagnostics.some((d) => d.code === "AGENT_PLUGIN_UNKNOWN_FIELD")).toBe(true);
    expect(
      loaded.diagnostics.some(
        (d) => d.code === "AGENT_PLUGIN_UNKNOWN_FIELD" && /skills/i.test(d.message),
      ),
    ).toBe(false);
  });

  test("omit keeps conventional discovery; empty shadows; list is exclusive", () => {
    const plugin = createPlugin();
    writeSkill(plugin, "keep");
    writeSkill(plugin, "drop");
    writeSkill(plugin, "nested/deeper");

    expect(
      discoverAgentPluginSkills({ root: plugin })
        .skills.map((s) => s.name)
        .sort(),
    ).toEqual(["drop", "keep"]);

    writeFileSync(
      join(plugin, "plugin.json"),
      JSON.stringify({
        $schema: AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
        name: "skills-decl",
        skills: [],
      }),
      "utf8",
    );
    const empty = discoverAgentPluginSkills({ root: plugin, packageName: "pkg" });
    expect(empty.skills).toEqual([]);
    expect(empty.diagnostics.some((d) => d.code === "AGENT_PLUGIN_SKILLS_EMPTY_SHADOWS")).toBe(
      true,
    );

    writeFileSync(
      join(plugin, "plugin.json"),
      JSON.stringify({
        $schema: AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
        name: "skills-decl",
        skills: ["keep"],
      }),
      "utf8",
    );
    expect(discoverAgentPluginSkills({ root: plugin }).skills.map((s) => s.name)).toEqual(["keep"]);
  });

  test("omit with no skills dir is empty; empty array without entries needs no shadow", () => {
    const bare = createPlugin();
    expect(discoverAgentPluginSkills({ root: bare }).skills).toEqual([]);

    writeFileSync(
      join(bare, "plugin.json"),
      JSON.stringify({
        $schema: AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
        name: "skills-decl",
        skills: [],
      }),
      "utf8",
    );
    const result = discoverAgentPluginSkills({ root: bare });
    expect(result.skills).toEqual([]);
    expect(result.diagnostics.some((d) => d.code === "AGENT_PLUGIN_SKILLS_EMPTY_SHADOWS")).toBe(
      false,
    );
  });

  test("path form, ./skills container, and duplicate declarations", () => {
    const plugin = createPlugin({ skills: ["skills/keep"] });
    writeSkill(plugin, "keep");
    writeSkill(plugin, "drop");
    expect(discoverAgentPluginSkills({ root: plugin }).skills.map((s) => s.name)).toEqual(["keep"]);

    writeFileSync(
      join(plugin, "plugin.json"),
      JSON.stringify({
        $schema: AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
        name: "skills-decl",
        skills: ["./skills"],
      }),
      "utf8",
    );
    writeSkill(plugin, "a");
    writeSkill(plugin, "b");
    expect(
      discoverAgentPluginSkills({ root: plugin })
        .skills.map((s) => s.name)
        .sort(),
    ).toEqual(["a", "b", "drop", "keep"]);

    writeFileSync(
      join(plugin, "plugin.json"),
      JSON.stringify({
        $schema: AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
        name: "skills-decl",
        skills: ["keep", "skills/keep", "keep"],
      }),
      "utf8",
    );
    const dup = discoverAgentPluginSkills({ root: plugin });
    expect(dup.skills.map((s) => s.name)).toEqual(["keep"]);
    expect(dup.skills).toHaveLength(1);
  });

  test("container expand and nested-depth / unknown / traversal / absolute fail-closed", () => {
    const plugin = createPlugin({ skills: ["skills"] });
    writeSkill(plugin, "a");
    writeSkill(plugin, "b");
    writeSkill(plugin, "nested/deeper");
    expect(
      discoverAgentPluginSkills({ root: plugin })
        .skills.map((s) => s.name)
        .sort(),
    ).toEqual(["a", "b"]);

    writeFileSync(
      join(plugin, "plugin.json"),
      JSON.stringify({
        $schema: AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
        name: "skills-decl",
        skills: ["skills/nested/deeper"],
      }),
      "utf8",
    );
    expect(() => discoverAgentPluginSkills({ root: plugin })).toThrow(
      /conventional-depth|declared|invalid/i,
    );

    writeFileSync(
      join(plugin, "plugin.json"),
      JSON.stringify({
        $schema: AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
        name: "skills-decl",
        skills: ["missing"],
      }),
      "utf8",
    );
    expect(() => discoverAgentPluginSkills({ root: plugin })).toThrow(AgentPluginsError);

    writeFileSync(
      join(plugin, "plugin.json"),
      JSON.stringify({
        $schema: AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
        name: "skills-decl",
        skills: ["../outside"],
      }),
      "utf8",
    );
    expect(() => discoverAgentPluginSkills({ root: plugin })).toThrow(/traversal|escape/i);

    writeFileSync(
      join(plugin, "plugin.json"),
      JSON.stringify({
        $schema: AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
        name: "skills-decl",
        skills: ["/tmp/abs-skill"],
      }),
      "utf8",
    );
    expect(() => discoverAgentPluginSkills({ root: plugin })).toThrow(
      /absolute|escape|invalid|declared/i,
    );
  });
});
