/**
 * Compatibility: skills declaration is in-boundary; matrix stays skills-capable.
 */
import { describe, expect, test } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadAgentPluginManifest } from "@b-apm/core";
import { repoRoot } from "../../install/helpers.ts";
import {
  cleanupRoot,
  createPluginRoot,
  manifestSkills,
  writePluginJson,
  writeSkill,
} from "./helpers.ts";

describe("agent-plugins compatibility — exclusive skills in boundary", () => {
  test("compatibility matrix lists skills as supported portable component", () => {
    const cases = JSON.parse(
      readFileSync(join(repoRoot, "tests/agent-plugins/compatibility-cases.json"), "utf8"),
    ) as {
      components: Array<{ id: string; status: string; summary: string }>;
      boundary?: string;
    };

    const skills = cases.components.find((c) => c.id === "skills");
    expect(skills).toBeTruthy();
    expect(["supported", "target-specific"]).toContain(skills!.status);
    expect(cases.boundary ?? "").toMatch(/portable|not an Agent Plugins certification|boundary/i);
  });

  test("well-typed skills array is not an unknown-field extension", () => {
    const root = createPluginRoot();
    try {
      writePluginJson(root, { skills: ["hello"] });
      writeSkill(root, "hello");

      const loaded = loadAgentPluginManifest({ root });

      expect(manifestSkills(loaded.manifest)).toEqual(["hello"]);
      expect(
        loaded.diagnostics.filter(
          (d) => d.code === "AGENT_PLUGIN_UNKNOWN_FIELD" && /skills/i.test(d.message),
        ),
      ).toEqual([]);
    } finally {
      cleanupRoot(root);
    }
  });
});
