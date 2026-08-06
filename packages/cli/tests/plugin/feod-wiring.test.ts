/**
 * CLI FEOD Plugin module thin-command wiring.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";

const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const srcRoot = join(cliRoot, "src");

function readSrc(rel: string): string {
  return readFileSync(join(srcRoot, rel), "utf8");
}

function listFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

describe("mp-plugin-init CLI FEOD Plugin wiring", () => {
  test("modules/Plugin is a directory module with index.ts (not single-file)", () => {
    const modulesDir = join(srcRoot, "modules");
    expect(readdirSync(modulesDir).filter((n) => n === "Plugin.ts")).toEqual([]);
    const modDir = join(modulesDir, "Plugin");
    expect(existsSync(modDir), "missing modules/Plugin").toBe(true);
    expect(statSync(modDir).isDirectory()).toBe(true);
    expect(existsSync(join(modDir, "index.ts")), "modules/Plugin/index.ts").toBe(true);
  });

  test("thin commands/plugin.ts + app/init/plugin.ts exist", () => {
    expect(existsSync(join(srcRoot, "commands", "plugin.ts"))).toBe(true);
    expect(existsSync(join(srcRoot, "app", "init", "plugin.ts"))).toBe(true);
  });

  test("registry and COMMAND_PLUGIN wire plugin", () => {
    const registry = readSrc("app/registry.ts");
    expect(registry).toMatch(/COMMAND_PLUGIN|pluginCommand|"plugin"/);
    const constants = readSrc("common/constants/commands.ts");
    expect(constants).toMatch(/COMMAND_PLUGIN|["']plugin["']/);
  });

  test("commands/plugin.ts does not import @bapm/core directly", () => {
    const body = readSrc("commands/plugin.ts");
    expect(body).not.toMatch(/from\s+["']@bapm\/core["']/);
  });

  test("Plugin module has no module-local commands/ folder", () => {
    const modDir = join(srcRoot, "modules", "Plugin");
    expect(existsSync(modDir)).toBe(true);
    expect(existsSync(join(modDir, "commands"))).toBe(false);
  });

  test("app/commands import Plugin only via @/modules/Plugin public entry", () => {
    const pluginCmd = readSrc("commands/plugin.ts");
    const pluginInit = readSrc("app/init/plugin.ts");
    expect(pluginCmd + "\n" + pluginInit).toMatch(/@\/modules\/Plugin/);
    expect(pluginCmd).not.toMatch(/@\/modules\/Plugin\//);
    expect(pluginInit).not.toMatch(/@\/modules\/Plugin\//);
  });

  test("createPlugin public API is importable", async () => {
    const mod = await import("@/modules/Plugin");
    expect(typeof mod.createPlugin).toBe("function");
  });

  test("commands/plugin.ts stays thin (no scaffold domain writers inline)", () => {
    const body = readSrc("commands/plugin.ts");
    expect(body).not.toMatch(/plugin\.json|writeFileSync|createMinimalManifest|validatePluginName/);
    expect(body.length).toBeLessThan(2500);
  });

  test("Plugin sources do not deep-import Manifest internals from commands layer", () => {
    const commandsDir = join(srcRoot, "commands");
    const offenders = listFilesRecursive(commandsDir)
      .filter((f) => f.endsWith(".ts"))
      .filter((f) => /modules\/Manifest\//.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
