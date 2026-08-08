import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, basename, join, relative, resolve } from "node:path";
import type {
  AttributedPrimitive,
  BapmIntegration,
  CompileContext,
  CompileReport,
  ConfigureMcpContext,
  ConfigureMcpReport,
  MaterializeReport,
  McpServerConfig,
} from "@bapm/integration-api";
import {
  assertUnderDeployRoots,
  primitivesList,
  readPrimitiveContent,
  sanitizeName,
  toPosixRel,
} from "@bapm/integration-api";

const DEFAULT_DEPLOY_ROOTS = [".agents/skills", ".cursor"] as const;
const MCP_JSON_REL = ".cursor/mcp.json";
const HOOKS_JSON_REL = ".cursor/hooks.json";
const HOOKS_OWNERSHIP_REL = ".cursor/bapm-hooks.json";
const COMMAND_PRESERVED_FRONTMATTER = new Set([
  "description",
  "allowed-tools",
  "model",
  "argument-hint",
  "input",
]);

/**
 * Create the Cursor target.
 * Detect: `.cursor/` directory **or** legacy `.cursorrules` file.
 * Materialize: skills → `.agents/skills/<name>/SKILL.md`,
 * instructions → `.cursor/rules/<name>.mdc`,
 * agents → `.cursor/agents/<name>.md`,
 * commands → `.cursor/commands/<name>.md`,
 * hooks → merge `.cursor/hooks.json` (+ script copy under `.cursor/hooks/`).
 * MCP: optional `configureMcp` writes `.cursor/mcp.json` (not via materialize).
 */
export function createCursorIntegration(options?: {
  id?: string;
  deployRoots?: string[];
}): BapmIntegration {
  const id = options?.id ?? "cursor";
  const deployRoots = [...(options?.deployRoots ?? DEFAULT_DEPLOY_ROOTS)];

  return {
    id,
    deployRoots,
    detect: ({ cwd }) => {
      const cursorDir = join(cwd, ".cursor");
      if (existsSync(cursorDir) && statSync(cursorDir).isDirectory()) return true;
      const legacy = join(cwd, ".cursorrules");
      return existsSync(legacy) && statSync(legacy).isFile();
    },
    getDeployRoots: () => [...deployRoots],
    async compile(primitives, context): Promise<CompileReport> {
      return compileCursorAgentsMd(primitivesList(primitives), context);
    },
    async materialize(primitives, ctx): Promise<MaterializeReport> {
      const cwd = resolve(ctx?.cwd ?? process.cwd());
      const roots = ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots;
      if (!roots.some((r) => r === ".agents/skills" || r.startsWith(".agents/skills"))) {
        throw new Error("cursor target missing .agents/skills deploy root");
      }
      if (!roots.some((r) => r === ".cursor" || r.startsWith(".cursor"))) {
        throw new Error("cursor target missing .cursor deploy root");
      }

      const deployedFiles: MaterializeReport["deployedFiles"] = [];
      const diagnostics: NonNullable<MaterializeReport["diagnostics"]> = [];
      const hookPrimitives: AttributedPrimitive[] = [];

      for (const p of primitivesList(primitives)) {
        const type = String(p.type ?? "skill").toLowerCase();
        const name = sanitizeName(String(p.name));

        if (/skill/.test(type)) {
          const destDir = join(cwd, ".agents", "skills", name);
          const destFile = join(destDir, "SKILL.md");
          assertUnderDeployRoots(cwd, destFile, roots);
          mkdirSync(destDir, { recursive: true });

          const src = p.path ? resolve(p.path) : undefined;
          if (p.format === "agent-plugin" && typeof p.skillDirectory === "string") {
            copyPortableSkillDirectory(p.skillDirectory, p.pluginRoot, destDir);
          } else if (src && existsSync(src)) {
            const skillMd = src.endsWith("SKILL.md") ? src : join(src, "SKILL.md");
            if (existsSync(skillMd) && statSync(skillMd).isFile()) {
              cpSync(skillMd, destFile);
            } else {
              writeFileSync(destFile, readPrimitiveContent(p, "SKILL.md"), "utf8");
            }
          } else {
            writeFileSync(destFile, readPrimitiveContent(p, "SKILL.md"), "utf8");
          }
          for (const path of listFiles(destDir)) {
            deployedFiles.push({
              path: toPosixRel(cwd, path),
              primitive: { name: String(p.name), packageName: p.packageName },
            });
          }
          continue;
        }

        if (/instruction/.test(type)) {
          const destFile = join(cwd, ".cursor", "rules", `${name}.mdc`);
          assertUnderDeployRoots(cwd, destFile, roots);
          mkdirSync(join(cwd, ".cursor", "rules"), { recursive: true });
          writeFileSync(destFile, readPrimitiveContent(p), "utf8");
          deployedFiles.push({
            path: toPosixRel(cwd, destFile),
            primitive: { name: String(p.name), packageName: p.packageName },
          });
          continue;
        }

        if (/agent/.test(type)) {
          const destFile = join(cwd, ".cursor", "agents", `${name}.md`);
          assertUnderDeployRoots(cwd, destFile, roots);
          mkdirSync(join(cwd, ".cursor", "agents"), { recursive: true });
          writeFileSync(destFile, readPrimitiveContent(p), "utf8");
          deployedFiles.push({
            path: toPosixRel(cwd, destFile),
            primitive: { name: String(p.name), packageName: p.packageName },
          });
          continue;
        }

        if (/command/.test(type)) {
          const destFile = join(cwd, ".cursor", "commands", `${name}.md`);
          assertUnderDeployRoots(cwd, destFile, roots);
          mkdirSync(join(cwd, ".cursor", "commands"), { recursive: true });
          const { content, droppedKeys } = transformCursorCommandMarkdown(readPrimitiveContent(p));
          writeFileSync(destFile, content, "utf8");
          deployedFiles.push({
            path: toPosixRel(cwd, destFile),
            primitive: { name: String(p.name), packageName: p.packageName },
          });
          if (droppedKeys.length > 0) {
            diagnostics.push({
              code: "CURSOR_COMMAND_FRONTMATTER_DROPPED",
              message: `Dropped non-preserved command frontmatter keys for "${p.name}": ${droppedKeys.join(", ")}`,
              primitive: String(p.name),
              droppedKeys,
            });
          }
          continue;
        }

        if (/hook/.test(type)) {
          hookPrimitives.push(p);
          continue;
        }
      }

      if (hookPrimitives.length > 0) {
        const hookDeployed = materializeCursorHooks({
          cwd,
          roots,
          hooks: hookPrimitives,
        });
        deployedFiles.push(...hookDeployed.deployedFiles);
        diagnostics.push(...hookDeployed.diagnostics);
      }

      return {
        targetId: id,
        deployedFiles,
        ...(diagnostics.length > 0 ? { diagnostics } : {}),
      };
    },
    async configureMcp(servers, ctx): Promise<ConfigureMcpReport> {
      return writeCursorMcpConfig(servers, {
        cwd: resolve(ctx?.cwd ?? process.cwd()),
        deployRoots: ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots,
        targetId: ctx?.targetId ?? id,
      });
    },
  };
}

function compileCursorAgentsMd(
  primitives: AttributedPrimitive[],
  context: CompileContext,
): CompileReport {
  const cwd = resolve(context.cwd);
  const outputFile = context.outputFile ?? "AGENTS.md";
  const outputPath = resolve(cwd, outputFile);
  const rel = relative(cwd, outputPath);
  if (!rel || rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    throw new Error("Cursor compile output must be a cwd-relative file path");
  }

  const content = renderCursorAgentsMd(primitives);
  const wrote = context.write;
  if (wrote) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, content, "utf8");
  }

  return { path: rel.replace(/\\/g, "/"), content, wrote };
}

function renderCursorAgentsMd(primitives: AttributedPrimitive[]): string {
  const sorted = [...primitives].sort((a, b) => {
    const type = String(a.type ?? "").localeCompare(String(b.type ?? ""));
    if (type !== 0) return type;
    const name = String(a.name ?? "").localeCompare(String(b.name ?? ""));
    return name !== 0 ? name : String(a.path ?? "").localeCompare(String(b.path ?? ""));
  });
  const sections = [
    "# AGENTS.md",
    "",
    "<!-- Generated by bapm compile. Do not edit by hand. -->",
    "",
  ];
  if (sorted.length === 0) return [...sections, "_No discoverable primitives._", ""].join("\n");

  for (const primitive of sorted) {
    sections.push(`## ${primitive.name} (${primitive.type})`, "");
    sections.push(readPrimitiveContent(primitive, `# ${primitive.name}\n`).trimEnd(), "");
  }
  return sections.join("\n");
}

/** Copy a validated portable skill directory without retaining symlinks. */
function copyPortableSkillDirectory(sourceDir: string, pluginRoot: unknown, destDir: string): void {
  const source = realpathSync(sourceDir);
  const root = typeof pluginRoot === "string" ? realpathSync(pluginRoot) : undefined;
  if (!root || !isWithin(root, source) || !statSync(source).isDirectory()) {
    throw new Error("Agent Plugin skill directory is outside its plugin root");
  }
  const skillFile = realpathSync(join(source, "SKILL.md"));
  if (
    !isWithin(root, skillFile) ||
    !statSync(skillFile).isFile() ||
    !treeIsContained(source, root, new Set())
  ) {
    throw new Error("Agent Plugin skill contains a path outside its plugin root");
  }
  mkdirSync(destDir, { recursive: true });
  cpSync(source, destDir, { recursive: true, dereference: true, force: true });
}

function treeIsContained(directory: string, root: string, visited: Set<string>): boolean {
  if (visited.has(directory)) return true;
  visited.add(directory);
  for (const entry of readdirSync(directory)) {
    const resolved = realpathSync(join(directory, entry));
    if (!isWithin(root, resolved)) return false;
    if (statSync(resolved).isDirectory() && !treeIsContained(resolved, root, visited)) return false;
  }
  return true;
}

function isWithin(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/") && rel !== "..");
}

function listFiles(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...listFiles(path));
    else files.push(path);
  }
  return files;
}

function writeCursorMcpConfig(
  servers: McpServerConfig[] | Record<string, McpServerConfig>,
  ctx: ConfigureMcpContext & { cwd: string; deployRoots: string[] },
): ConfigureMcpReport {
  const { cwd, deployRoots } = ctx;
  if (!deployRoots.some((r) => r === ".cursor" || r.startsWith(".cursor"))) {
    throw new Error("cursor configureMcp requires a registered .cursor deploy root");
  }

  const destFile = join(cwd, ".cursor", "mcp.json");
  assertUnderDeployRoots(cwd, destFile, deployRoots);
  mkdirSync(join(cwd, ".cursor"), { recursive: true });

  const existing = readExistingMcpServers(destFile);
  const { entries: incoming, diagnostics } = normalizeServerEntries(servers);
  const next: Record<string, Record<string, unknown>> = { ...existing };

  const writtenNames: string[] = [];
  for (const [name, entry] of Object.entries(incoming)) {
    next[name] = entry;
    writtenNames.push(name);
  }

  const doc = { mcpServers: next };
  writeFileSync(destFile, `${JSON.stringify(doc, null, 2)}\n`, "utf8");

  return {
    targetId: ctx.targetId,
    configPath: MCP_JSON_REL,
    servers: writtenNames,
    deployedFiles: [{ path: MCP_JSON_REL }],
    diagnostics,
  } as ConfigureMcpReport;
}

function readExistingMcpServers(path: string): Record<string, Record<string, unknown>> {
  if (!existsSync(path)) return {};
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as {
      mcpServers?: Record<string, Record<string, unknown>>;
    };
    return raw.mcpServers && typeof raw.mcpServers === "object" ? { ...raw.mcpServers } : {};
  } catch {
    return {};
  }
}

function normalizeServerEntries(servers: McpServerConfig[] | Record<string, McpServerConfig>): {
  entries: Record<string, Record<string, unknown>>;
  diagnostics: Array<{ code: string; message: string; server?: string }>;
} {
  const out: Record<string, Record<string, unknown>> = {};
  const diagnostics: Array<{ code: string; message: string; server?: string }> = [];
  const list: McpServerConfig[] = Array.isArray(servers)
    ? servers
    : Object.entries(servers).map(([name, value]) => ({
        ...value,
        name: value.name ?? name,
      }));

  for (const server of list) {
    const name = String(server.name ?? "").trim();
    if (!name) continue;
    const entry = toCursorServerEntry(server);
    if (!entry) {
      diagnostics.push({
        code: "CURSOR_PORTABLE_MCP_UNSUPPORTED",
        message: `Cursor cannot faithfully represent portable MCP server "${name}"`,
        server: name,
      });
      continue;
    }
    out[name] = entry;
  }
  return { entries: out, diagnostics };
}

function toCursorServerEntry(server: McpServerConfig): Record<string, unknown> | undefined {
  const transport = String(server.transport ?? server.type ?? "").toLowerCase();
  const entry: Record<string, unknown> = {};
  const portable = server.format === "agent-plugin";

  if (portable) {
    // Portable v1 is deliberately adapted field-by-field, never copied as Cursor JSON.
    if (transport === "stdio") {
      if (typeof server.command !== "string") return undefined;
      entry.command = server.command;
      if (Array.isArray(server.args)) entry.args = server.args;
      if (typeof server.cwd === "string") entry.cwd = server.cwd;
      entry.type = "stdio";
    } else if (transport === "streamable-http" || transport === "sse") {
      if (typeof server.url !== "string") return undefined;
      entry.url = server.url;
      entry.type = transport === "streamable-http" ? "http" : "sse";
    } else {
      return undefined;
    }
    if (server.env && typeof server.env === "object") entry.env = server.env;
    return entry;
  }

  if (transport === "http" || transport === "sse" || typeof server.url === "string") {
    if (server.url) entry.url = server.url;
    if (transport) entry.type = transport === "sse" ? "sse" : "http";
  } else {
    // stdio default
    if (server.command) entry.command = server.command;
    if (Array.isArray(server.args)) entry.args = server.args;
    entry.type = "stdio";
  }

  if (server.env && typeof server.env === "object") {
    entry.env = server.env;
  }

  // Preserve native extra keys, but never portable adapter metadata.
  for (const [key, value] of Object.entries(server)) {
    if (
      [
        "name",
        "transport",
        "type",
        "command",
        "args",
        "url",
        "env",
        "packageName",
        "registry",
        "format",
        "cwd",
      ].includes(key)
    ) {
      continue;
    }
    if (value !== undefined) entry[key] = value;
  }

  return entry;
}

type HookEntry = { command?: string; [key: string]: unknown };
type HooksDoc = {
  version?: number;
  hooks?: Record<string, HookEntry[]>;
  [key: string]: unknown;
};
type OwnershipSidecar = {
  owned: Record<
    string,
    {
      packageName?: string;
      entries: Array<{ event: string; command: string }>;
      scripts: string[];
    }
  >;
};

function transformCursorCommandMarkdown(source: string): {
  content: string;
  droppedKeys: string[];
} {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { content: source, droppedKeys: [] };

  const rawFm = match[1] ?? "";
  const body = match[2] ?? "";
  const kept: string[] = [];
  const droppedKeys: string[] = [];

  for (const line of rawFm.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const keyMatch = line.match(/^([A-Za-z0-9_-]+)\s*:/);
    if (!keyMatch) {
      kept.push(line);
      continue;
    }
    const key = keyMatch[1]!;
    if (COMMAND_PRESERVED_FRONTMATTER.has(key)) {
      kept.push(line);
    } else {
      droppedKeys.push(key);
    }
  }

  const fmBlock = kept.length > 0 ? `---\n${kept.join("\n")}\n---\n` : "";
  return { content: `${fmBlock}${body}`.replace(/\s+$/, "\n"), droppedKeys };
}

function materializeCursorHooks(args: {
  cwd: string;
  roots: string[];
  hooks: AttributedPrimitive[];
}): {
  deployedFiles: MaterializeReport["deployedFiles"];
  diagnostics: NonNullable<MaterializeReport["diagnostics"]>;
} {
  const { cwd, roots, hooks } = args;
  const deployedFiles: MaterializeReport["deployedFiles"] = [];
  const diagnostics: NonNullable<MaterializeReport["diagnostics"]> = [];

  const hooksPath = join(cwd, HOOKS_JSON_REL);
  const ownershipPath = join(cwd, HOOKS_OWNERSHIP_REL);
  assertUnderDeployRoots(cwd, hooksPath, roots);
  assertUnderDeployRoots(cwd, ownershipPath, roots);
  mkdirSync(join(cwd, ".cursor"), { recursive: true });

  const doc = readHooksDoc(hooksPath);
  const ownership = readOwnershipSidecar(ownershipPath);

  // Remove previously owned bapm entries so re-install is idempotent.
  stripOwnedEntries(doc, ownership);

  const nextOwned: OwnershipSidecar["owned"] = {};

  for (const p of hooks) {
    const name = sanitizeName(String(p.name));
    const srcPath = p.path ? resolve(p.path) : undefined;
    if (!srcPath || !existsSync(srcPath) || !statSync(srcPath).isFile()) {
      diagnostics.push({
        code: "CURSOR_HOOK_SOURCE_MISSING",
        message: `Hook primitive "${p.name}" has no readable source JSON`,
        primitive: String(p.name),
      });
      continue;
    }

    let parsed: HooksDoc;
    try {
      parsed = JSON.parse(readFileSync(srcPath, "utf8")) as HooksDoc;
    } catch (cause) {
      diagnostics.push({
        code: "CURSOR_HOOK_JSON_INVALID",
        message: `Hook "${p.name}" JSON is invalid: ${cause instanceof Error ? cause.message : String(cause)}`,
        primitive: String(p.name),
      });
      continue;
    }

    const sourceHooks = parsed.hooks && typeof parsed.hooks === "object" ? parsed.hooks : {};
    const ownedEntries: Array<{ event: string; command: string }> = [];
    const scripts: string[] = [];

    if (!doc.hooks || typeof doc.hooks !== "object") doc.hooks = {};
    if (typeof parsed.version === "number" && doc.version === undefined) {
      doc.version = parsed.version;
    }

    for (const [event, entries] of Object.entries(sourceHooks)) {
      if (!Array.isArray(entries)) continue;
      const destList = Array.isArray(doc.hooks[event]) ? [...doc.hooks[event]!] : [];
      for (const entry of entries) {
        if (!entry || typeof entry !== "object") continue;
        const command = typeof entry.command === "string" ? entry.command.trim() : "";
        if (!command) {
          destList.push({ ...entry });
          continue;
        }

        const rewritten = copyHookScript({
          cwd,
          roots,
          hookName: name,
          hookFile: srcPath,
          command,
        });
        const nextEntry: HookEntry = { ...entry, command: rewritten.commandRel };
        destList.push(nextEntry);
        ownedEntries.push({ event, command: rewritten.commandRel });
        if (rewritten.scriptRel) {
          scripts.push(rewritten.scriptRel);
          deployedFiles.push({
            path: rewritten.scriptRel,
            primitive: { name: String(p.name), packageName: p.packageName },
          });
        }
      }
      doc.hooks[event] = destList;
    }

    nextOwned[name] = {
      ...(p.packageName ? { packageName: p.packageName } : {}),
      entries: ownedEntries,
      scripts,
    };
  }

  if (doc.version === undefined) doc.version = 1;
  writeFileSync(hooksPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  writeFileSync(
    ownershipPath,
    `${JSON.stringify({ owned: nextOwned } satisfies OwnershipSidecar, null, 2)}\n`,
    "utf8",
  );

  deployedFiles.push({
    path: HOOKS_JSON_REL,
    // Attribute to first hook when possible for lock inventory.
    ...(hooks[0]
      ? { primitive: { name: String(hooks[0].name), packageName: hooks[0].packageName } }
      : {}),
  });
  deployedFiles.push({
    path: HOOKS_OWNERSHIP_REL,
    ...(hooks[0]
      ? { primitive: { name: String(hooks[0].name), packageName: hooks[0].packageName } }
      : {}),
  });

  return { deployedFiles, diagnostics };
}

function copyHookScript(args: {
  cwd: string;
  roots: string[];
  hookName: string;
  hookFile: string;
  command: string;
}): { commandRel: string; scriptRel?: string } {
  const { cwd, roots, hookName, hookFile, command } = args;
  // Absolute / already-under-.cursor commands: keep as-is when already registered.
  if (command.includes(".cursor/")) {
    return { commandRel: command.startsWith("./") ? command : `./${command.replace(/^\//, "")}` };
  }

  const cleaned = command.replace(/^\.\//, "");
  const packageRoot = findHookPackageRoot(hookFile);
  const candidates = [resolve(dirname(hookFile), cleaned), resolve(packageRoot, cleaned)];
  const source = candidates.find((p) => {
    try {
      return existsSync(p) && statSync(p).isFile();
    } catch {
      return false;
    }
  });
  if (!source) {
    // Keep original path if script is missing — still merge entry.
    return { commandRel: command };
  }

  const destRel = `.cursor/hooks/${hookName}/${basename(source)}`;
  const destAbs = join(cwd, destRel);
  assertUnderDeployRoots(cwd, destAbs, roots);
  mkdirSync(dirname(destAbs), { recursive: true });
  cpSync(source, destAbs);
  return { commandRel: `./${destRel}`, scriptRel: destRel };
}

/** Nearest package root for hook script resolution (apm.yml / bapm.yml / plugin.json). */
function findHookPackageRoot(hookFile: string): string {
  let dir = dirname(hookFile);
  for (;;) {
    if (
      existsSync(join(dir, "apm.yml")) ||
      existsSync(join(dir, "bapm.yml")) ||
      existsSync(join(dir, "plugin.json"))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dirname(hookFile);
}

function readHooksDoc(path: string): HooksDoc {
  if (!existsSync(path)) return { version: 1, hooks: {} };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as HooksDoc;
    if (!raw || typeof raw !== "object") return { version: 1, hooks: {} };
    if (!raw.hooks || typeof raw.hooks !== "object") raw.hooks = {};
    return raw;
  } catch {
    return { version: 1, hooks: {} };
  }
}

function readOwnershipSidecar(path: string): OwnershipSidecar {
  if (!existsSync(path)) return { owned: {} };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as OwnershipSidecar;
    if (!raw || typeof raw !== "object" || !raw.owned || typeof raw.owned !== "object") {
      return { owned: {} };
    }
    return raw;
  } catch {
    return { owned: {} };
  }
}

function stripOwnedEntries(doc: HooksDoc, ownership: OwnershipSidecar): void {
  if (!doc.hooks || typeof doc.hooks !== "object") return;
  const ownedCommands = new Set<string>();
  for (const record of Object.values(ownership.owned ?? {})) {
    for (const entry of record.entries ?? []) {
      if (entry.command) ownedCommands.add(entry.command);
    }
  }
  if (ownedCommands.size === 0) return;

  for (const [event, entries] of Object.entries(doc.hooks)) {
    if (!Array.isArray(entries)) continue;
    doc.hooks[event] = entries.filter((e) => {
      const cmd = typeof e?.command === "string" ? e.command : "";
      return !ownedCommands.has(cmd);
    });
  }
}
