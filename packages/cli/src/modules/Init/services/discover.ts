/**
 * Read-only discovery of existing agent harness content.
 *
 * Detection reuses the canonical host marker probe (which mirrors published
 * integration `detect()` checks) and never imports host packages. Local `.apm/`
 * content is read through core `discoverPrimitives`. No file is written.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { discoverPrimitives } from "@b-apm/core";
import { probeCanonicalHostMarkersDetailed } from "@/common/canonicalHosts.ts";
import type {
  DiscoveredHost,
  DiscoveryEntry,
  DiscoveryInventory,
  DiscoveryKind,
  ProjectDiscoveryReport,
} from "../types/discover.types.ts";

const MANIFEST_NAMES = ["bapm.yml", "apm.yml"] as const;

const SKILL_ROOTS = [
  ".agents/skills",
  ".apm/skills",
  "skills",
  ".claude/skills",
  ".cursor/skills",
  ".codex/skills",
  ".opencode/skills",
  ".kiro/skills",
  ".grok/skills",
  ".gemini/skills",
  ".windsurf/skills",
  "agent-data/workflows",
] as const;

const RULE_ROOT_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  ".cursorrules",
  ".github/copilot-instructions.md",
] as const;

const RULE_DIRS = [
  ".cursor/rules",
  ".claude/rules",
  ".windsurf/rules",
  ".kiro/steering",
  ".grok/rules",
  ".github/instructions",
  ".agents/rules",
] as const;

const COMMAND_DIRS = [
  ".cursor/commands",
  ".claude/commands",
  ".codex/prompts",
  ".github/prompts",
  ".gemini/commands",
  ".opencode/commands",
  ".grok/commands",
  ".windsurf/workflows",
  ".agents/commands",
  ".kiro/prompts",
] as const;

const HOOK_CONFIG_FILES = [
  ".cursor/hooks.json",
  ".codex/hooks.json",
  ".windsurf/hooks.json",
] as const;

const HOOK_SETTINGS_FILES = [".claude/settings.json", ".gemini/settings.json"] as const;

const HOOK_DIRS = [".github/hooks", ".kiro/hooks", ".agents/hooks"] as const;

const MCP_CONFIG_FILES = [
  ".cursor/mcp.json",
  ".mcp.json",
  ".codex/config.toml",
  ".gemini/settings.json",
  ".vscode/mcp.json",
  ".github/mcp.json",
  ".opencode/opencode.json",
  "opencode.json",
  "opencode.jsonc",
  ".kiro/settings/mcp.json",
  ".agents/mcp_config.json",
  ".windsurf/mcp_config.json",
] as const;

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function safeReaddir(path: string): string[] {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}

function toPosix(path: string): string {
  return path.split("\\").join("/");
}

function relativePath(cwd: string, path: string): string {
  return toPosix(relative(cwd, path));
}

function hostForPath(path: string): string | null {
  const first = path.split("/")[0]!;
  if (first === "agent-data") return "grok-bot";
  if (first === ".agents" || first === ".apm" || first === "skills") return null;
  if (first === ".cursor" || path === ".cursorrules") return "cursor";
  if (first === ".claude" || path === "CLAUDE.md" || path === ".mcp.json") return "claude";
  if (first === ".codex") return "codex";
  if (first === ".github") return "copilot";
  if (first === ".opencode" || path === "opencode.json" || path === "opencode.jsonc") {
    return "opencode";
  }
  if (first === ".windsurf") return "windsurf";
  if (first === ".gemini" || path === "GEMINI.md") return "gemini";
  if (first === ".kiro") return "kiro";
  if (first === ".grok") return "grok-build";
  return null;
}

function walkFiles(
  root: string,
  visit: (path: string, name: string) => void,
  depth = 0,
  maxDepth = 6,
): void {
  if (depth > maxDepth || !isDirectory(root)) return;
  for (const name of safeReaddir(root)) {
    if (name === "node_modules" || name === ".git") continue;
    const full = join(root, name);
    if (isDirectory(full)) {
      walkFiles(full, visit, depth + 1, maxDepth);
      continue;
    }
    if (isFile(full)) visit(full, name);
  }
}

function isRuleFile(name: string): boolean {
  return /\.(md|mdc|markdown)$/i.test(name);
}

function isCommandFile(name: string): boolean {
  return /\.(md|toml|prompt\.md)$/i.test(name);
}

function isJsonFile(name: string): boolean {
  return /\.jsonc?$/i.test(name);
}

function addEntry(inventory: DiscoveryInventory, kind: DiscoveryKind, entry: DiscoveryEntry): void {
  const nameMatters = kind === "hooks" || kind === "mcp";
  const exists = inventory[kind].some(
    (item) =>
      item.path === entry.path && (!nameMatters || (item.name ?? "") === (entry.name ?? "")),
  );
  if (!exists) inventory[kind].push(entry);
}

function localPrimitiveEntries(cwd: string, inventory: DiscoveryInventory): void {
  let primitives: ReturnType<typeof discoverPrimitives>;
  try {
    primitives = discoverPrimitives({ cwd, packageRoots: [] });
  } catch {
    return;
  }

  for (const primitive of primitives) {
    const path = relativePath(cwd, primitive.path);
    const host = hostForPath(path);
    const entry: DiscoveryEntry = {
      path,
      host,
      ...(primitive.name ? { name: primitive.name } : {}),
    };
    const type = String(primitive.type).toLowerCase();
    if (type === "skill") addEntry(inventory, "skills", entry);
    else if (type === "instruction") addEntry(inventory, "rules", entry);
    else if (type === "command") addEntry(inventory, "commands", entry);
    else if (type === "hook") addEntry(inventory, "hooks", entry);
  }
}

function scanSkills(cwd: string, inventory: DiscoveryInventory): void {
  for (const root of SKILL_ROOTS) {
    const absolute = join(cwd, root);
    walkFiles(absolute, (path, name) => {
      if (name !== "SKILL.md") return;
      const rel = relativePath(cwd, path);
      addEntry(inventory, "skills", {
        path: rel,
        host: hostForPath(rel),
        name: basename(toPosix(path).replace(/\/SKILL\.md$/, "")),
      });
    });
  }

  const rootSkill = join(cwd, "SKILL.md");
  if (isFile(rootSkill)) {
    addEntry(inventory, "skills", {
      path: "SKILL.md",
      host: null,
      name: basename(cwd),
    });
  }
}

function scanRules(cwd: string, inventory: DiscoveryInventory): void {
  for (const rel of RULE_ROOT_FILES) {
    if (!isFile(join(cwd, rel))) continue;
    addEntry(inventory, "rules", {
      path: rel,
      host: hostForPath(rel),
      name: basename(rel).replace(/\.(md|markdown)$/i, ""),
    });
  }

  for (const root of RULE_DIRS) {
    walkFiles(join(cwd, root), (path, name) => {
      if (!isRuleFile(name)) return;
      const rel = relativePath(cwd, path);
      addEntry(inventory, "rules", {
        path: rel,
        host: hostForPath(rel),
        name: name.replace(/\.(md|mdc|markdown)$/i, ""),
      });
    });
  }
}

function scanCommands(cwd: string, inventory: DiscoveryInventory): void {
  for (const root of COMMAND_DIRS) {
    walkFiles(join(cwd, root), (path, name) => {
      if (!isCommandFile(name)) return;
      const rel = relativePath(cwd, path);
      addEntry(inventory, "commands", {
        path: rel,
        host: hostForPath(rel),
        name: name.replace(/\.(prompt\.md|md|toml)$/i, ""),
      });
    });
  }
}

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function readJsonc(path: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    // Best-effort JSONC: strip comments and trailing commas. Read-only and
    // deliberately conservative; parse failures are reported as one entry.
    const stripped = text
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1")
      .replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(stripped);
    } catch {
      return undefined;
    }
  }
}

function hookNames(payload: unknown): string[] {
  const object = asObject(payload);
  if (!object) return [];
  const hooks = object.hooks;
  if (Array.isArray(hooks)) {
    return hooks.map((_, index) => `hook[${index}]`);
  }
  const events = asObject(hooks);
  if (!events) return [];

  const names: string[] = [];
  for (const [event, value] of Object.entries(events)) {
    if (!Array.isArray(value)) {
      names.push(event);
      continue;
    }
    let handlers = 0;
    for (const item of value) {
      const group = asObject(item);
      const nested = group && Array.isArray(group.hooks) ? group.hooks.length : 0;
      handlers += nested > 0 ? nested : 1;
    }
    if (handlers === 0) names.push(event);
    else for (let index = 0; index < handlers; index++) names.push(event);
  }
  return names;
}

function scanHookFile(cwd: string, rel: string, inventory: DiscoveryInventory): void {
  const absolute = join(cwd, rel);
  if (!isFile(absolute)) return;
  const names = hookNames(readJsonc(absolute));
  if (names.length > 0) {
    for (const name of names) {
      addEntry(inventory, "hooks", { path: rel, host: hostForPath(rel), name });
    }
    return;
  }
  // A dedicated hooks file or a settings file without a hooks key. Dedicated
  // files still count as one source; settings files with no hooks are ignored.
  if ((HOOK_SETTINGS_FILES as readonly string[]).includes(rel)) return;
  addEntry(inventory, "hooks", { path: rel, host: hostForPath(rel) });
}

function scanHooks(cwd: string, inventory: DiscoveryInventory): void {
  for (const rel of HOOK_CONFIG_FILES) scanHookFile(cwd, rel, inventory);
  for (const rel of HOOK_SETTINGS_FILES) scanHookFile(cwd, rel, inventory);

  for (const root of HOOK_DIRS) {
    walkFiles(join(cwd, root), (path, name) => {
      if (!isJsonFile(name)) return;
      scanHookFile(cwd, relativePath(cwd, path), inventory);
    });
  }
}

function mcpServerNames(payload: unknown): string[] {
  const object = asObject(payload);
  if (!object) return [];

  for (const key of ["mcpServers", "servers"] as const) {
    const servers = asObject(object[key]);
    if (servers) return Object.keys(servers);
  }

  const mcp = asObject(object.mcp);
  if (mcp) {
    const servers = asObject(mcp.servers);
    if (servers) return Object.keys(servers);
    // OpenCode keeps named server objects directly under `mcp`.
    if (Object.values(mcp).some((value) => asObject(value))) {
      return Object.keys(mcp);
    }
  }

  // VS Code style nesting `{ mcp: { servers: { … } } }` is handled above; some
  // hosts use `{ servers: { … } }` (handled) and Claude uses `.mcp.json`.
  return [];
}

function tomlMcpServerNames(text: string): string[] {
  const names = new Set<string>();
  const section = /^\s*\[mcp_servers\.(?:"([^"]+)"|([^\]\s]+))\]/gm;
  for (const match of text.matchAll(section)) {
    const name = match[1] ?? match[2];
    if (name) names.add(name);
  }
  return [...names];
}

function scanMcp(cwd: string, inventory: DiscoveryInventory): void {
  for (const rel of MCP_CONFIG_FILES) {
    const absolute = join(cwd, rel);
    if (!isFile(absolute)) continue;

    let names: string[] = [];
    if (rel.endsWith(".toml")) {
      try {
        names = tomlMcpServerNames(readFileSync(absolute, "utf8"));
      } catch {
        names = [];
      }
    } else {
      names = mcpServerNames(readJsonc(absolute));
    }

    if (names.length === 0) {
      // Keep an unparseable / empty config visible without inventing servers.
      if (readJsonc(absolute) === undefined) {
        addEntry(inventory, "mcp", { path: rel, host: hostForPath(rel) });
      }
      continue;
    }
    for (const name of names) {
      addEntry(inventory, "mcp", { path: rel, host: hostForPath(rel), name });
    }
  }
}

function detectedHosts(cwd: string): DiscoveredHost[] {
  return probeCanonicalHostMarkersDetailed(cwd)
    .map((host) => ({ id: host.id, markers: host.markers }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Discover existing harness content. Never writes, loads packages, or uses network. */
export function discoverProject(cwd: string): ProjectDiscoveryReport {
  const manifestPath = MANIFEST_NAMES.find((name) => existsSync(join(cwd, name))) ?? null;
  const hosts = detectedHosts(cwd);

  const inventory: DiscoveryInventory = {
    skills: [],
    rules: [],
    commands: [],
    hooks: [],
    mcp: [],
  };

  localPrimitiveEntries(cwd, inventory);
  scanSkills(cwd, inventory);
  scanRules(cwd, inventory);
  scanCommands(cwd, inventory);
  scanHooks(cwd, inventory);
  scanMcp(cwd, inventory);

  for (const kind of Object.keys(inventory) as DiscoveryKind[]) {
    inventory[kind].sort((a, b) =>
      a.path === b.path ? (a.name ?? "").localeCompare(b.name ?? "") : a.path.localeCompare(b.path),
    );
  }

  const suggestedActive = hosts.map((host) => host.id);
  return {
    schemaVersion: 1,
    cwd,
    manifest: { exists: manifestPath !== null, path: manifestPath },
    hosts,
    suggestedActive,
    inventory,
    counts: {
      hosts: hosts.length,
      skills: inventory.skills.length,
      rules: inventory.rules.length,
      commands: inventory.commands.length,
      hooks: inventory.hooks.length,
      mcp: inventory.mcp.length,
    },
    applied: false,
  };
}
