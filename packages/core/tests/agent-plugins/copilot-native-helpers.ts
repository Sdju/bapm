/**
 * Helpers for Copilot native Agent Plugins registration tests.
 * Specs: copilot-native-agent-plugins, install-pipeline, integration-copilot-runtime,
 * lifecycle-uninstall-prune, agent-plugins-compatibility.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { expect } from "vite-plus/test";
import { createIntegrationRegistry } from "@b-apm/integration-api";
import type {
  AttributedPrimitive,
  BapmIntegration,
  MaterializeReport,
} from "@b-apm/integration-api";
import { createCursorIntegration } from "@b-apm/integration-cursor";
import { AGENT_PLUGIN_MANIFEST_SCHEMA_V1 } from "@b-apm/core";
import {
  expectRejectsMatching,
  getRunInstall,
  modulesDir,
  repoRoot,
  type TempProject,
} from "../install/helpers.ts";
import { getRunPrune, getRunUninstall } from "../lifecycle/helpers.ts";

export {
  expectRejectsMatching,
  getRunInstall,
  getRunPrune,
  getRunUninstall,
  modulesDir,
  repoRoot,
  type TempProject,
};

export const AGENT_PLUGIN_SCHEMA = AGENT_PLUGIN_MANIFEST_SCHEMA_V1;

export const MARKETPLACE_REL = join("apm_modules", ".github", "plugin", "marketplace.json");
export const LEDGER_REL = join("apm_modules", ".github", "plugin", "apm-registration.json");
export const SETTINGS_REL = join(".github", "copilot", "settings.local.json");

export function createTempProject(prefix = "bapm-copilot-native-"): TempProject {
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

export function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

export function writeJson(path: string, value: unknown): void {
  writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeSkill(pluginRoot: string, name: string, body?: string): string {
  const dir = join(pluginRoot, "skills", name);
  writeText(join(dir, "SKILL.md"), body ?? `---\nname: ${name}\n---\n# ${name}\n`);
  return dir;
}

export function writeApmSkill(pkgRoot: string, name: string, body?: string): string {
  const dir = join(pkgRoot, ".apm", "skills", name);
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
      name: "my-plugin",
      version: "1.0.0",
      ...fields,
    }),
    "utf8",
  );
  return path;
}

/**
 * Portable Agent Plugin root with optional apm.yml (distinct package name for collisions).
 */
export function writePortablePlugin(
  root: string,
  options: {
    pluginName?: string;
    packageName?: string;
    version?: string;
    skill?: string;
    deps?: string[];
    withApmYml?: boolean;
  } = {},
): void {
  const pluginName = options.pluginName ?? "my-plugin";
  const packageName = options.packageName ?? pluginName;
  const skill = options.skill ?? "hello";
  mkdirSync(root, { recursive: true });
  writePluginJson(root, { name: pluginName, version: options.version ?? "1.0.0" });
  writeSkill(root, skill, `---\nname: ${skill}\n---\n# ${packageName}\n`);
  if (
    options.withApmYml === true ||
    options.packageName ||
    (options.deps && options.deps.length > 0)
  ) {
    const deps = options.deps ?? [];
    const depLines =
      deps.length === 0 ? " []" : `\n${deps.map((d) => `    - path: ${d}`).join("\n")}`;
    writeText(
      join(root, "apm.yml"),
      `name: ${packageName}\nversion: ${options.version ?? "0.0.1"}\ndependencies:\n  apm:${depLines}\n`,
    );
  }
}

/** Mock Copilot target: materializes skills under `.agents/skills/` like the real integration. */
export function createMockCopilotIntegration(options?: {
  id?: string;
  onMaterialize?: (primitives: AttributedPrimitive[]) => void;
}): BapmIntegration {
  const id = options?.id ?? "copilot";
  return {
    id,
    deployRoots: [".github", ".agents"],
    detect: () => false,
    getDeployRoots: () => [".github", ".agents"],
    async materialize(primitives, ctx): Promise<MaterializeReport> {
      const list = Array.isArray(primitives)
        ? primitives
        : ((primitives as { primitives?: AttributedPrimitive[] })?.primitives ?? []);
      options?.onMaterialize?.(list as AttributedPrimitive[]);
      const cwd = ctx?.cwd ?? process.cwd();
      const deployedFiles: NonNullable<MaterializeReport["deployedFiles"]> = [];
      for (const p of list as AttributedPrimitive[]) {
        const type = String(p.type ?? "").toLowerCase();
        if (type !== "skill") continue;
        const name = String(p.name ?? p.id ?? "").trim();
        if (!name) continue;
        const src = String(p.path ?? "");
        const destRel = join(".agents", "skills", name, "SKILL.md");
        const destAbs = join(cwd, destRel);
        mkdirSync(dirname(destAbs), { recursive: true });
        if (src && existsSync(src) && statSync(src).isFile()) {
          writeFileSync(destAbs, readFileSync(src));
        } else if (src && existsSync(join(src, "SKILL.md"))) {
          writeFileSync(destAbs, readFileSync(join(src, "SKILL.md")));
        } else {
          writeText(destAbs, `---\nname: ${name}\n---\n# ${name}\n`);
        }
        deployedFiles.push({ path: destRel, hash: "mock" });
      }
      return { targetId: id, deployedFiles };
    },
  };
}

export function createCopilotRegistry(options?: {
  onMaterialize?: (primitives: AttributedPrimitive[]) => void;
}) {
  const registry = createIntegrationRegistry();
  registry.register(createMockCopilotIntegration({ onMaterialize: options?.onMaterialize }));
  return registry;
}

export function createCopilotCursorRegistry(options?: {
  onCopilotMaterialize?: (primitives: AttributedPrimitive[]) => void;
}) {
  const registry = createIntegrationRegistry();
  registry.register(createMockCopilotIntegration({ onMaterialize: options?.onCopilotMaterialize }));
  registry.register(createCursorIntegration());
  return registry;
}

export function writeConsumerManifest(
  project: TempProject,
  options: {
    name?: string;
    pluginRel?: string | string[];
    targets?: "copilot" | "copilot+cursor" | Record<string, string>;
  } = {},
): void {
  const deps = Array.isArray(options.pluginRel)
    ? options.pluginRel
    : [options.pluginRel ?? "./plugin"];
  const depLines = deps.map((d) => `    - path: ${d}`).join("\n");

  let targetBlock: string[];
  if (options.targets === "copilot+cursor") {
    targetBlock = [
      "targets:",
      '  copilot: "@b-apm/integration-copilot"',
      '  cursor: "@b-apm/integration-cursor"',
    ];
  } else if (options.targets && typeof options.targets === "object") {
    targetBlock = [
      "targets:",
      ...Object.entries(options.targets).map(([k, v]) => `  ${k}: "${v}"`),
    ];
  } else {
    targetBlock = ["target: copilot"];
  }

  writeText(
    join(project.cwd, "bapm.yml"),
    [
      `name: ${options.name ?? "copilot-native-consumer"}`,
      "version: 0.0.1",
      ...targetBlock,
      "dependencies:",
      "  apm:",
      depLines,
      "",
    ].join("\n"),
  );
}

export async function installForCopilot(
  project: TempProject,
  options: {
    registry?: ReturnType<typeof createCopilotRegistry>;
    dryRun?: boolean;
    activeTargets?: string[];
    forcedTarget?: string;
  } = {},
): Promise<unknown> {
  const registry = options.registry ?? createCopilotRegistry();
  return getRunInstall()({
    cwd: project.cwd,
    frozen: false,
    dryRun: options.dryRun === true,
    integrationRegistry: registry,
    registry,
    forcedTarget: options.forcedTarget ?? "copilot",
    forceTarget: options.forcedTarget ?? "copilot",
    ...(options.activeTargets ? { activeTargets: options.activeTargets } : {}),
  });
}

export function marketplacePath(cwd: string): string {
  return join(cwd, MARKETPLACE_REL);
}

export function ledgerPath(cwd: string): string {
  return join(cwd, LEDGER_REL);
}

export function settingsPath(cwd: string): string {
  return join(cwd, SETTINGS_REL);
}

export function agentsSkillPath(cwd: string, skillName: string): string {
  return join(cwd, ".agents", "skills", skillName, "SKILL.md");
}

export function listUnderModules(cwd: string): string[] {
  const root = modulesDir(cwd);
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, ent.name);
      const rel = relative(root, abs);
      if (ent.isDirectory()) walk(abs);
      else out.push(rel.replace(/\\/g, "/"));
    }
  };
  walk(root);
  return out.sort();
}

/** Assert catalog lists plugin and points under apm_modules (live path, no private copy). */
export function expectCatalogListsPlugin(cwd: string, pluginName: string): void {
  const path = marketplacePath(cwd);
  expect(existsSync(path)).toBe(true);
  const doc = readJson(path);
  const blob = JSON.stringify(doc);
  expect(blob).toMatch(new RegExp(pluginName));
  expect(blob).toMatch(/apm_modules/);
  expect(existsSync(ledgerPath(cwd))).toBe(true);
}

export function expectSettingsEnablePlugin(cwd: string, pluginName: string): void {
  const path = settingsPath(cwd);
  expect(existsSync(path)).toBe(true);
  const doc = readJson(path);
  const marketplaces = doc.extraKnownMarketplaces as Record<string, unknown> | undefined;
  expect(marketplaces).toBeTruthy();
  const apm = marketplaces!.apm as Record<string, unknown> | undefined;
  expect(apm).toBeTruthy();
  const source = (apm!.source ?? apm) as Record<string, unknown>;
  const nested = (source.source ?? source) as Record<string, unknown>;
  const pathVal =
    (typeof nested.path === "string" && nested.path) ||
    (typeof source.path === "string" && source.path) ||
    "";
  expect(pathVal.replace(/\\/g, "/")).toMatch(/(^|\/)apm_modules\/?$/);
  const enabled = doc.enabledPlugins as Record<string, unknown> | undefined;
  expect(enabled).toBeTruthy();
  expect(enabled![`${pluginName}@apm`]).toBe(true);
}

export function expectNoPrivateCopilotPluginCopy(cwd: string): void {
  expect(existsSync(join(cwd, "installed-plugins"))).toBe(false);
  expect(existsSync(join(cwd, ".copilot", "installed-plugins"))).toBe(false);
  expect(existsSync(join(cwd, ".github", "copilot", "installed-plugins"))).toBe(false);
}

export function flattenInstallDiagnostics(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const r = result as Record<string, unknown>;
  const bags = [r.diagnostics, r.warnings, r.messages, r.errors];
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

export function lockExists(cwd: string): boolean {
  return existsSync(join(cwd, "bapm.lock.yaml")) || existsSync(join(cwd, "apm.lock.yaml"));
}
