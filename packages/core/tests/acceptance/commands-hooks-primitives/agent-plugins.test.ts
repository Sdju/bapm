/**
 * Acceptance: Agent Plugins declared commands/hooks + matrix honesty.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../../install/helpers.ts";
import {
  AGENT_PLUGIN_SCHEMA,
  createCursorRegistry,
  createTempProject,
  cursorFlatHookJson,
  getRunInstall,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("commands-hooks-primitives — Agent Plugins declared paths", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("declared commands path materializes under .cursor/commands/", async () => {
    project = createTempProject();
    const plugin = join(project.cwd, "plugin");
    mkdirSync(join(plugin, "commands"), { recursive: true });
    writeFileSync(
      join(plugin, "plugin.json"),
      JSON.stringify({
        $schema: AGENT_PLUGIN_SCHEMA,
        name: "cmd-plugin",
        version: "1.0.0",
        commands: ["./commands/ship.md"],
      }),
      "utf8",
    );
    writeText(join(plugin, "commands", "ship.md"), "---\ndescription: ship\n---\n# Ship\n");
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: ap-cmd\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm:\n    - path: ./plugin\n`,
      "utf8",
    );

    const registry = createCursorRegistry();
    await getRunInstall()({
      cwd: project.cwd,
      frozen: false,
      integrationRegistry: registry,
      registry,
    });

    expect(existsSync(join(project.cwd, ".cursor", "commands", "ship.md"))).toBe(true);
  });

  test("declared hooks path merges under .cursor/hooks.json", async () => {
    project = createTempProject();
    const plugin = join(project.cwd, "plugin");
    mkdirSync(join(plugin, "hooks"), { recursive: true });
    writeFileSync(
      join(plugin, "plugin.json"),
      JSON.stringify({
        $schema: AGENT_PLUGIN_SCHEMA,
        name: "hook-plugin",
        version: "1.0.0",
        hooks: ["./hooks/session-start.json"],
      }),
      "utf8",
    );
    writeText(join(plugin, "hooks", "session-start.json"), cursorFlatHookJson("./hooks/run.sh"));
    writeText(join(plugin, "hooks", "run.sh"), "#!/bin/sh\necho hi\n");
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: ap-hook\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm:\n    - path: ./plugin\n`,
      "utf8",
    );

    const registry = createCursorRegistry();
    await getRunInstall()({
      cwd: project.cwd,
      frozen: false,
      integrationRegistry: registry,
      registry,
    });

    expect(existsSync(join(project.cwd, ".cursor", "hooks.json"))).toBe(true);
    const hooks = readFileSync(join(project.cwd, ".cursor", "hooks.json"), "utf8");
    expect(hooks).toMatch(/sessionStart|command/i);
  });

  test("missing declared commands path fails closed before deploy/lock commit", async () => {
    project = createTempProject();
    const plugin = join(project.cwd, "plugin");
    mkdirSync(plugin, { recursive: true });
    writeFileSync(
      join(plugin, "plugin.json"),
      JSON.stringify({
        $schema: AGENT_PLUGIN_SCHEMA,
        name: "missing-cmd",
        version: "1.0.0",
        commands: ["./commands/absent.md"],
      }),
      "utf8",
    );
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: ap-missing\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm:\n    - path: ./plugin\n`,
      "utf8",
    );

    const registry = createCursorRegistry();
    await expect(
      getRunInstall()({
        cwd: project.cwd,
        frozen: false,
        integrationRegistry: registry,
        registry,
      }),
    ).rejects.toThrow(/absent|missing|commands|path/i);

    expect(existsSync(join(project.cwd, "bapm.lock.yaml"))).toBe(false);
    expect(existsSync(join(project.cwd, "apm.lock.yaml"))).toBe(false);
    expect(existsSync(join(project.cwd, ".cursor", "commands"))).toBe(false);
  });

  test("escaping declared hooks path fails closed", async () => {
    project = createTempProject();
    const plugin = join(project.cwd, "plugin");
    mkdirSync(plugin, { recursive: true });
    writeFileSync(
      join(plugin, "plugin.json"),
      JSON.stringify({
        $schema: AGENT_PLUGIN_SCHEMA,
        name: "escape-hook",
        version: "1.0.0",
        hooks: ["../outside-hooks.json"],
      }),
      "utf8",
    );
    writeText(join(project.cwd, "outside-hooks.json"), cursorFlatHookJson("./x.sh"));
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: ap-escape\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm:\n    - path: ./plugin\n`,
      "utf8",
    );

    const registry = createCursorRegistry();
    await expect(
      getRunInstall()({
        cwd: project.cwd,
        frozen: false,
        integrationRegistry: registry,
        registry,
      }),
    ).rejects.toThrow(/escape|outside|hooks|path|traversal/i);

    expect(existsSync(join(project.cwd, "bapm.lock.yaml"))).toBe(false);
  });

  test("compatibility matrix lists commands/hooks as supported, not blanket not-supported", () => {
    const cases = JSON.parse(
      readFileSync(join(repoRoot, "tests/agent-plugins/compatibility-cases.json"), "utf8"),
    ) as {
      components: Array<{ id: string; status: string; summary: string }>;
    };

    const commands = cases.components.find((c) => c.id === "commands");
    const hooks = cases.components.find((c) => c.id === "hooks");
    expect(commands).toBeTruthy();
    expect(hooks).toBeTruthy();
    expect(["supported", "target-specific"]).toContain(commands!.status);
    expect(["supported", "target-specific"]).toContain(hooks!.status);

    const unsupported = cases.components.find((c) => c.id === "unsupported-components");
    if (unsupported) {
      expect(unsupported.summary.toLowerCase()).not.toMatch(/\bcommands\b/);
      expect(unsupported.summary.toLowerCase()).not.toMatch(/\bhooks\b/);
    }
  });
});
