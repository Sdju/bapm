/**
 * Exclusive discover: omit / [] / list / container / fail-closed / shadow.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { discoverAgentPluginSkills, AgentPluginsError } from "@b-apm/core";
import {
  cleanupRoot,
  createPluginRoot,
  hasEmptySkillsShadowDiagnostic,
  manifestSkills,
  skillNames,
  writePluginJson,
  writeSkill,
} from "./helpers.ts";

describe("discoverAgentPluginSkills exclusive skills declaration", () => {
  let root: string | undefined;

  afterEach(() => {
    cleanupRoot(root);
    root = undefined;
  });

  test("omit discovers only immediate skills/<name>/SKILL.md (not nested deeper)", () => {
    root = createPluginRoot();
    writePluginJson(root, {});
    writeSkill(root, "alpha");
    writeSkill(root, "nested/deeper");

    const result = discoverAgentPluginSkills({ root });

    expect(skillNames(result)).toEqual(["alpha"]);
    expect(result.skills.some((s) => s.name === "nested" || s.name === "deeper")).toBe(false);
  });

  test("omit with no skills directory yields zero skills without error", () => {
    root = createPluginRoot();
    writePluginJson(root, {});

    const result = discoverAgentPluginSkills({ root });

    expect(result.skills).toEqual([]);
  });

  test("empty skills array deploys zero skills and emits shadow diagnostic when conventional entries exist", () => {
    root = createPluginRoot();
    writePluginJson(root, { skills: [], name: "shadow-empty" });
    writeSkill(root, "hello");

    const result = discoverAgentPluginSkills({ root, packageName: "shadow-empty" });

    expect(result.skills).toEqual([]);
    expect(hasEmptySkillsShadowDiagnostic(result.diagnostics)).toBe(true);
    expect(
      result.diagnostics.some(
        (d) =>
          /shadow|empty|omit|declare/i.test(d.message) &&
          (/shadow-empty|plugin/i.test(d.message) || d.path),
      ),
    ).toBe(true);
  });

  test("empty skills array with no conventional skills needs no shadow diagnostic", () => {
    root = createPluginRoot();
    writePluginJson(root, { skills: [] });

    const result = discoverAgentPluginSkills({ root });

    expect(result.skills).toEqual([]);
    expect(manifestSkills(result.manifest)).toEqual([]);
    expect(hasEmptySkillsShadowDiagnostic(result.diagnostics)).toBe(false);
  });

  test("declared subset excludes undeclared siblings", () => {
    root = createPluginRoot();
    writePluginJson(root, { skills: ["keep"] });
    writeSkill(root, "keep");
    writeSkill(root, "drop");

    const result = discoverAgentPluginSkills({ root });

    expect(skillNames(result)).toEqual(["keep"]);
    expect(result.skills.some((s) => s.name === "drop")).toBe(false);
  });

  test("declared path form skills/<name> resolves exclusively", () => {
    root = createPluginRoot();
    writePluginJson(root, { skills: ["skills/keep"] });
    writeSkill(root, "keep");
    writeSkill(root, "drop");

    const result = discoverAgentPluginSkills({ root });

    expect(skillNames(result)).toEqual(["keep"]);
  });

  test("declared container skills expands immediate children only", () => {
    root = createPluginRoot();
    writePluginJson(root, { skills: ["skills"] });
    writeSkill(root, "a");
    writeSkill(root, "b");
    writeSkill(root, "nested/deeper");

    const result = discoverAgentPluginSkills({ root });

    expect(manifestSkills(result.manifest)).toEqual(["skills"]);
    expect(skillNames(result)).toEqual(["a", "b"]);
  });

  test("declared ./skills container expands the same way", () => {
    root = createPluginRoot();
    writePluginJson(root, { skills: ["./skills"] });
    writeSkill(root, "a");
    writeSkill(root, "b");

    const result = discoverAgentPluginSkills({ root });

    expect(manifestSkills(result.manifest)).toEqual(["./skills"]);
    expect(skillNames(result)).toEqual(["a", "b"]);
  });

  test("duplicate declared entries resolve to a single skill", () => {
    root = createPluginRoot();
    writePluginJson(root, { skills: ["keep", "skills/keep", "keep"] });
    writeSkill(root, "keep");
    writeSkill(root, "drop");

    const result = discoverAgentPluginSkills({ root });

    expect(skillNames(result)).toEqual(["keep"]);
    expect(result.skills).toHaveLength(1);
    expect(result.skills.some((s) => s.name === "drop")).toBe(false);
  });

  test("unknown declared skill fails closed", () => {
    root = createPluginRoot();
    const pluginRoot = root;
    writePluginJson(pluginRoot, { skills: ["missing-skill"] });
    writeSkill(pluginRoot, "present");

    expect(() => discoverAgentPluginSkills({ root: pluginRoot })).toThrow(AgentPluginsError);
    expect(() => discoverAgentPluginSkills({ root: pluginRoot })).toThrow(
      /missing-skill|declared|invalid|unknown|not found/i,
    );
  });

  test("traversal declared skill fails closed", () => {
    root = createPluginRoot();
    const pluginRoot = root;
    writePluginJson(pluginRoot, { skills: ["../outside"] });

    expect(() => discoverAgentPluginSkills({ root: pluginRoot })).toThrow(AgentPluginsError);
    expect(() => discoverAgentPluginSkills({ root: pluginRoot })).toThrow(
      /\.\.|traversal|escape|outside|invalid/i,
    );
  });

  test("absolute declared skill path fails closed", () => {
    root = createPluginRoot();
    const pluginRoot = root;
    writePluginJson(pluginRoot, { skills: ["/tmp/abs-skill"] });

    expect(() => discoverAgentPluginSkills({ root: pluginRoot })).toThrow(AgentPluginsError);
    expect(() => discoverAgentPluginSkills({ root: pluginRoot })).toThrow(
      /absolute|escape|invalid|declared/i,
    );
  });
});
