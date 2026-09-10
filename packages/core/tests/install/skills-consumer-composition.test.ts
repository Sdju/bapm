/**
 * Composition: exclusive plugin skills before consumer skillSubset;
 * dep skills: [] remains parse error (not plugin exclusive empty).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync } from "node:fs";
import { parseManifest } from "@b-apm/core";
import {
  agentsSkillPath,
  createCursorRegistry,
  createTempProject,
  expectThrowsMatching,
  getRunInstall,
  writeConsumerWithPluginPath,
  writePluginJson,
  writeSkill,
  writeText,
  type TempProject,
} from "./skills-exclusive-helpers.ts";
import { join } from "node:path";

describe("exclusive plugin skills vs consumer dep skills subset", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("consumer skillSubset further narrows declared plugin skills", async () => {
    project = createTempProject("bapm-pskills-compose-");
    const plugin = writeConsumerWithPluginPath(project, {
      name: "compose-subset",
      // Ask for alpha + gamma; gamma exists on disk but is outside plugin exclusive list.
      skillsSubset: ["alpha", "gamma"],
    });
    writePluginJson(plugin, {
      name: "compose-plugin",
      skills: ["alpha", "beta"],
    });
    writeSkill(plugin, "alpha");
    writeSkill(plugin, "beta");
    writeSkill(plugin, "gamma");

    const registry = createCursorRegistry();
    await getRunInstall()({
      cwd: project.cwd,
      frozen: false,
      integrationRegistry: registry,
      registry,
    });

    expect(existsSync(agentsSkillPath(project.cwd, "alpha"))).toBe(true);
    expect(existsSync(agentsSkillPath(project.cwd, "beta"))).toBe(false);
    // Exclusive must run before subset: gamma is on disk and in consumer subset but
    // outside plugin declaration, so it must not deploy.
    expect(existsSync(agentsSkillPath(project.cwd, "gamma"))).toBe(false);
  });

  test("consumer dep skills: [] remains a parse error (not exclusive zero)", () => {
    expectThrowsMatching(
      () =>
        parseManifest({
          name: "dep-empty-skills",
          version: "0.0.1",
          dependencies: {
            apm: [{ id: "acme/toolkit", version: "1.0.0", skills: [] }],
          },
        }),
      /at least one skill|skills.*empty|non-empty.*skill/i,
    );

    expectThrowsMatching(
      () =>
        parseManifest({
          name: "dep-empty-skills-git",
          version: "0.0.1",
          dependencies: {
            apm: [{ git: "https://github.com/acme/toolkit.git", skills: [] }],
          },
        }),
      /at least one skill|skills.*empty|non-empty.*skill/i,
    );
  });

  test("path dep skills: [] also parse-fails (not reinterpreted as plugin empty)", async () => {
    project = createTempProject("bapm-pskills-path-empty-");
    const plugin = join(project.cwd, "plugin");
    writePluginJson(plugin, { name: "path-empty-plugin" });
    writeSkill(plugin, "hello");
    writeText(
      join(project.cwd, "bapm.yml"),
      [
        "name: path-empty-dep",
        "version: 0.0.1",
        "target: cursor",
        "dependencies:",
        "  apm:",
        "    - path: ./plugin",
        "      skills: []",
        "",
      ].join("\n"),
    );

    const registry = createCursorRegistry();
    await expect(
      getRunInstall()({
        cwd: project.cwd,
        frozen: false,
        integrationRegistry: registry,
        registry,
      }),
    ).rejects.toThrow(/at least one skill|skills.*empty|non-empty.*skill|manifest/i);
  });
});
