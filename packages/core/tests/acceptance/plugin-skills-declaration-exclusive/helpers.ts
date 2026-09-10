/**
 * Helpers for plugin-skills-declaration-exclusive acceptance (RED → GREEN).
 * Specs: plugin-skills-declaration, agent-plugins-compatibility, install-pipeline.
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
} from "../../install/helpers.ts";

export { getRunInstall, expectThrowsMatching, expectRejectsMatching, type TempProject };

export const AGENT_PLUGIN_SCHEMA = AGENT_PLUGIN_MANIFEST_SCHEMA_V1;

/** Diagnostic shape from AgentPlugins load/discover (skills may not be typed yet). */
export type PluginDiagnostic = {
  code: string;
  message: string;
  path?: string;
  severity?: string;
};

export type ManifestWithSkills = {
  skills?: string[];
  name?: string;
  [key: string]: unknown;
};

export function createTempProject(prefix = "bapm-pskills-"): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

export function createPluginRoot(prefix = "bapm-plugin-skills-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function cleanupRoot(root: string | undefined): void {
  if (root) rmSync(root, { recursive: true, force: true });
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

export function skillNames(result: { skills: Array<{ name: string }> }): string[] {
  return result.skills.map((s) => s.name).sort();
}

export function diagnosticCodes(diagnostics: PluginDiagnostic[]): string[] {
  return diagnostics.map((d) => d.code);
}

/** True when a diagnostic is the empty-skills shadow warning (code or message). */
export function hasEmptySkillsShadowDiagnostic(diagnostics: PluginDiagnostic[]): boolean {
  return diagnostics.some((d) => {
    if (/SKILLS_EMPTY|EMPTY_SHADOWS|SKILLS_SHADOW/i.test(d.code)) return true;
    return /shadow|empty.*skills|omit.*(key|skills)|declare.*skills/i.test(d.message);
  });
}

export function manifestSkills(manifest: unknown): string[] | undefined {
  if (!manifest || typeof manifest !== "object") return undefined;
  const skills = (manifest as ManifestWithSkills).skills;
  return Array.isArray(skills) ? (skills as string[]) : skills === undefined ? undefined : [];
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
