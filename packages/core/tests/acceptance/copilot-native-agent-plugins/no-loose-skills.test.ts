/**
 * No loose Copilot skill/MCP projection for admitted portable plugins;
 * ordinary non-plugin skills still materialize; Cursor multi-target intact.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  agentsSkillPath,
  createCopilotCursorRegistry,
  createCopilotRegistry,
  createTempProject,
  expectCatalogListsPlugin,
  expectSettingsEnablePlugin,
  getRunInstall,
  installForCopilot,
  writeApmSkill,
  writeConsumerManifest,
  writePortablePlugin,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("copilot native registration skips loose primitives", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("admitted portable skill is not double-deployed under .agents/skills for Copilot", async () => {
    project = createTempProject("bapm-cnap-noloose-");
    const plugin = join(project.cwd, "plugin");
    writePortablePlugin(plugin, { pluginName: "my-plugin", skill: "hello" });
    writeConsumerManifest(project);
    writeText(
      join(plugin, "mcp.json"),
      JSON.stringify({
        mcpServers: { demo: { type: "stdio", command: "node", args: ["server.mjs"] } },
      }),
    );

    let seenSkills: string[] = [];
    const registry = createCopilotRegistry({
      onMaterialize: (primitives) => {
        seenSkills = primitives
          .filter((p) => String(p.type ?? "").toLowerCase() === "skill")
          .map((p) => String(p.name ?? ""));
      },
    });

    await installForCopilot(project, { registry });

    expectCatalogListsPlugin(project.cwd, "my-plugin");
    expectSettingsEnablePlugin(project.cwd, "my-plugin");
    expect(existsSync(agentsSkillPath(project.cwd, "hello"))).toBe(false);
    expect(seenSkills).not.toContain("hello");
  });

  test("ordinary non-plugin Copilot skill still materializes under .agents/skills", async () => {
    project = createTempProject("bapm-cnap-ordinary-");
    const leaf = join(project.cwd, "leaf");
    writeText(join(leaf, "apm.yml"), "name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n");
    writeApmSkill(leaf, "plain-skill");
    writeConsumerManifest(project, { name: "ordinary", pluginRel: "./leaf" });

    await installForCopilot(project);

    expect(existsSync(agentsSkillPath(project.cwd, "plain-skill"))).toBe(true);
    expect(
      existsSync(join(project.cwd, "apm_modules", ".github", "plugin", "marketplace.json")),
    ).toBe(false);
  });

  test("Cursor still materializes portable skills while Copilot registers natively", async () => {
    project = createTempProject("bapm-cnap-multi-");
    const plugin = join(project.cwd, "plugin");
    writePortablePlugin(plugin, { pluginName: "my-plugin", skill: "hello" });
    writeConsumerManifest(project, {
      name: "multi-target",
      targets: "copilot+cursor",
    });
    // Cursor detect signal
    writeText(join(project.cwd, ".cursor", ".keep"), "");

    const registry = createCopilotCursorRegistry();
    await getRunInstall()({
      cwd: project.cwd,
      frozen: false,
      integrationRegistry: registry,
      registry,
      activeTargets: ["copilot", "cursor"],
    });

    expectCatalogListsPlugin(project.cwd, "my-plugin");
    expectSettingsEnablePlugin(project.cwd, "my-plugin");
    // Copilot must not get loose skill; Cursor may (shared .agents/skills is Cursor deploy).
    // Spec: Copilot MUST NOT loose-project; Cursor MAY still materialize.
    expect(existsSync(agentsSkillPath(project.cwd, "hello"))).toBe(true);
    expect(readFileSync(agentsSkillPath(project.cwd, "hello"), "utf8")).toMatch(/my-plugin|hello/i);
  });
});
