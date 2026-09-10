/**
 * Install consumes exclusive plugin skills; fail-closed before lock/deploy.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  agentsSkillPath,
  createCursorRegistry,
  createTempProject,
  flattenInstallDiagnostics,
  getRunInstall,
  writeConsumerWithPluginPath,
  writePluginJson,
  writeSkill,
  type TempProject,
} from "./skills-exclusive-helpers.ts";

describe("install respects exclusive plugin.json skills", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("install materializes only declared plugin skills", async () => {
    project = createTempProject("bapm-pskills-install-");
    const plugin = writeConsumerWithPluginPath(project, { name: "decl-subset" });
    writePluginJson(plugin, { name: "decl-subset-plugin", skills: ["keep"] });
    writeSkill(plugin, "keep");
    writeSkill(plugin, "drop");

    const registry = createCursorRegistry();
    await getRunInstall()({
      cwd: project.cwd,
      frozen: false,
      integrationRegistry: registry,
      registry,
    });

    expect(existsSync(agentsSkillPath(project.cwd, "keep"))).toBe(true);
    expect(existsSync(agentsSkillPath(project.cwd, "drop"))).toBe(false);
  });

  test("install deploys nothing for empty plugin skills and surfaces shadow diagnostic", async () => {
    project = createTempProject("bapm-pskills-empty-");
    const plugin = writeConsumerWithPluginPath(project, { name: "empty-skills" });
    writePluginJson(plugin, { name: "empty-skills-plugin", skills: [] });
    writeSkill(plugin, "hello");

    const registry = createCursorRegistry();
    const result = await getRunInstall()({
      cwd: project.cwd,
      frozen: false,
      integrationRegistry: registry,
      registry,
    });

    expect(existsSync(agentsSkillPath(project.cwd, "hello"))).toBe(false);
    const diagText = flattenInstallDiagnostics(result);
    expect(diagText).toMatch(/shadow|empty.*skills|omit.*(key|skills)|declare/i);
  });

  test("invalid declared plugin skill aborts before lock commit", async () => {
    project = createTempProject("bapm-pskills-missing-");
    const plugin = writeConsumerWithPluginPath(project, { name: "missing-decl" });
    writePluginJson(plugin, { name: "missing-decl-plugin", skills: ["nope"] });
    writeSkill(plugin, "present");

    const registry = createCursorRegistry();
    await expect(
      getRunInstall()({
        cwd: project.cwd,
        frozen: false,
        integrationRegistry: registry,
        registry,
      }),
    ).rejects.toThrow(/nope|declared|invalid|missing|unknown|skill/i);

    expect(existsSync(join(project.cwd, "bapm.lock.yaml"))).toBe(false);
    expect(existsSync(join(project.cwd, "apm.lock.yaml"))).toBe(false);
    expect(existsSync(agentsSkillPath(project.cwd, "present"))).toBe(false);
    expect(existsSync(agentsSkillPath(project.cwd, "nope"))).toBe(false);
  });

  test("escaping declared plugin skill aborts before lock commit", async () => {
    project = createTempProject("bapm-pskills-escape-");
    const plugin = writeConsumerWithPluginPath(project, { name: "escape-decl" });
    writePluginJson(plugin, { name: "escape-decl-plugin", skills: ["../outside"] });

    const registry = createCursorRegistry();
    await expect(
      getRunInstall()({
        cwd: project.cwd,
        frozen: false,
        integrationRegistry: registry,
        registry,
      }),
    ).rejects.toThrow(/\.\.|traversal|escape|outside|invalid|declared/i);

    expect(existsSync(join(project.cwd, "bapm.lock.yaml"))).toBe(false);
  });
});
