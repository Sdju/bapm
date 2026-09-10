/**
 * Helpers for exclusive plugin.json skills install / composition suites.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createIntegrationRegistry } from "@b-apm/integration-api";
import { createCursorIntegration } from "@b-apm/integration-cursor";
import { AGENT_PLUGIN_MANIFEST_SCHEMA_V1 } from "@b-apm/core";
import {
  getRunInstall,
  expectThrowsMatching,
  expectRejectsMatching,
  type TempProject,
} from "./helpers.ts";

export { getRunInstall, expectThrowsMatching, expectRejectsMatching, type TempProject };

export const AGENT_PLUGIN_SCHEMA = AGENT_PLUGIN_MANIFEST_SCHEMA_V1;

export function createTempProject(prefix = "bapm-pskills-"): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

export function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

export function writeSkill(pluginRoot: string, name: string, body?: string): string {
  const dir = join(pluginRoot, "skills", name);
  writeText(join(dir, "SKILL.md"), body ?? `---\nname: ${name}\n---\n# ${name}\n`);
  return dir;
}

export function writePluginJson(pluginRoot: string, fields: Record<string, unknown> = {}): string {
  mkdirSync(pluginRoot, { recursive: true });
  const path = join(pluginRoot, "plugin.json");
  writeFileSync(
    path,
    JSON.stringify({
      $schema: AGENT_PLUGIN_SCHEMA,
      name: "skills-plugin",
      version: "1.0.0",
      ...fields,
    }),
    "utf8",
  );
  return path;
}

export function createCursorRegistry() {
  const registry = createIntegrationRegistry();
  registry.register(createCursorIntegration());
  return registry;
}

export function writeConsumerWithPluginPath(
  project: TempProject,
  options: {
    pluginRel?: string;
    name?: string;
    skillsSubset?: string[];
  } = {},
): string {
  const pluginRel = options.pluginRel ?? "./plugin";
  const plugin = join(project.cwd, pluginRel.replace(/^\.\//, ""));
  mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
  mkdirSync(join(project.cwd, ".agents"), { recursive: true });

  const subsetLines =
    options.skillsSubset && options.skillsSubset.length > 0
      ? [`      skills: [${options.skillsSubset.join(", ")}]`]
      : [];

  writeText(
    join(project.cwd, "bapm.yml"),
    [
      `name: ${options.name ?? "skills-consumer"}`,
      "version: 0.0.1",
      "target: cursor",
      "dependencies:",
      "  apm:",
      "    - path: " + pluginRel,
      ...subsetLines,
      "",
    ].join("\n"),
  );
  return plugin;
}

export function agentsSkillPath(cwd: string, skillName: string): string {
  return join(cwd, ".agents", "skills", skillName, "SKILL.md");
}

export function flattenInstallDiagnostics(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const r = result as Record<string, unknown>;
  const bags = [r.diagnostics, r.warnings, r.messages];
  const parts: string[] = [];
  for (const bag of bags) {
    if (!Array.isArray(bag)) continue;
    for (const item of bag) {
      if (typeof item === "string") parts.push(item);
      else if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        parts.push([o.code, o.message, o.msg].filter(Boolean).join(" "));
      }
    }
  }
  return parts.join("\n");
}
