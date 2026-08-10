import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type {
  AttributedPrimitive,
  BapmIntegration,
  CompileReport,
  ConfigureMcpContext,
  ConfigureMcpReport,
  HookOwnershipSidecar,
  MaterializeReport,
  McpServerConfig,
} from "@b-apm/integration-api";
import {
  SHARED_COMMAND_FRONTMATTER_KEYS,
  assertUnderDeployRoots,
  compileMarkdownReport,
  copyHookScript,
  filterFrontmatterKeys,
  materializeSkill,
  primitivesList,
  primitivesMaterialize,
  readHookOwnershipSidecar,
  readPrimitiveContent,
  renderPrimitivesMarkdown,
  sanitizeName,
  stripOwnedHookCommands,
  writeDeployedFile,
  writeHookOwnershipSidecar,
} from "@b-apm/integration-api";

const DEFAULT_DEPLOY_ROOTS = [".claude", "."] as const;
const MCP_JSON_REL = ".mcp.json";
const SETTINGS_JSON_REL = ".claude/settings.json";
const HOOKS_OWNERSHIP_REL = ".claude/bapm-hooks.json";

/**
 * Create the Claude Code target.
 * Detect: `.claude/` directory **or** project-root `CLAUDE.md`.
 * Materialize: skills → `.claude/skills/<name>/SKILL.md` (never `.agents/skills/`),
 * instructions → `.claude/rules/<name>.md` (`applyTo` → `paths`),
 * agents → `.claude/agents/<name>.md`,
 * commands → `.claude/commands/<name>.md`,
 * hooks → merge `.claude/settings.json` (+ scripts under `.claude/hooks/`, ownership sidecar).
 * MCP: optional `configureMcp` writes project `.mcp.json` when `.claude/` exists.
 * Compile: default `CLAUDE.md`, omitting instruction primitives.
 */
export function createClaudeIntegration(options?: {
  id?: string;
  deployRoots?: string[];
}): BapmIntegration {
  const id = options?.id ?? "claude";
  const deployRoots = [...(options?.deployRoots ?? DEFAULT_DEPLOY_ROOTS)];

  return {
    id,
    deployRoots,
    detect: ({ cwd }) => {
      const claudeDir = join(cwd, ".claude");
      if (existsSync(claudeDir) && statSync(claudeDir).isDirectory()) return true;
      const claudeMd = join(cwd, "CLAUDE.md");
      return existsSync(claudeMd) && statSync(claudeMd).isFile();
    },
    getDeployRoots: () => [...deployRoots],
    async compile(primitives, context): Promise<CompileReport> {
      const content = renderPrimitivesMarkdown({
        primitives: primitivesList(primitives),
        title: "# CLAUDE.md",
        filter: (p) => !/instruction/i.test(String(p.type ?? "")),
      });
      return compileMarkdownReport({
        cwd: context.cwd,
        outputFile: context.outputFile ?? "CLAUDE.md",
        write: context.write,
        content,
        outsideCwdMessage: "Claude compile output must be a cwd-relative file path",
      });
    },
    async materialize(primitives, ctx): Promise<MaterializeReport> {
      const cwd = resolve(ctx?.cwd ?? process.cwd());
      const roots = ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots;
      if (!roots.some((r) => r === ".claude" || r.startsWith(".claude"))) {
        throw new Error("claude target missing .claude deploy root");
      }

      const deployedFiles: MaterializeReport["deployedFiles"] = [];
      const diagnostics: NonNullable<MaterializeReport["diagnostics"]> = [];
      const hookPrimitives: AttributedPrimitive[] = [];

      await primitivesMaterialize(primitives, {
        skill(p, { name }) {
          deployedFiles.push(
            ...materializeSkill({
              primitive: p,
              cwd,
              deployRoots: roots,
              destDir: join(".claude", "skills", name),
            }),
          );
        },
        instruction(p, { name }) {
          deployedFiles.push(
            writeDeployedFile({
              cwd,
              deployRoots: roots,
              destRel: join(".claude", "rules", `${name}.md`),
              content: transformClaudeRulesMarkdown(readPrimitiveContent(p)),
              primitive: { name: String(p.name), packageName: p.packageName },
            }),
          );
        },
        agent(p, { name }) {
          deployedFiles.push(
            writeDeployedFile({
              cwd,
              deployRoots: roots,
              destRel: join(".claude", "agents", `${name}.md`),
              content: readPrimitiveContent(p),
              primitive: { name: String(p.name), packageName: p.packageName },
            }),
          );
        },
        command(p, { name }) {
          const { content, droppedKeys } = filterFrontmatterKeys(
            readPrimitiveContent(p),
            SHARED_COMMAND_FRONTMATTER_KEYS,
          );
          deployedFiles.push(
            writeDeployedFile({
              cwd,
              deployRoots: roots,
              destRel: join(".claude", "commands", `${name}.md`),
              content,
              primitive: { name: String(p.name), packageName: p.packageName },
            }),
          );
          if (droppedKeys.length > 0) {
            diagnostics.push({
              code: "CLAUDE_COMMAND_FRONTMATTER_DROPPED",
              message: `Dropped non-preserved command frontmatter keys for "${p.name}": ${droppedKeys.join(", ")}`,
              primitive: String(p.name),
              droppedKeys,
            });
          }
        },
        hook(p) {
          hookPrimitives.push(p);
        },
      });

      if (hookPrimitives.length > 0) {
        const hookDeployed = materializeClaudeHooks({
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
      return writeClaudeMcpConfig(servers, {
        cwd: resolve(ctx?.cwd ?? process.cwd()),
        deployRoots: ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots,
        targetId: ctx?.targetId ?? id,
      });
    },
  };
}

function writeClaudeMcpConfig(
  servers: McpServerConfig[] | Record<string, McpServerConfig>,
  ctx: ConfigureMcpContext & { cwd: string; deployRoots: string[] },
): ConfigureMcpReport {
  const { cwd, deployRoots } = ctx;

  const claudeDir = join(cwd, ".claude");
  if (!existsSync(claudeDir) || !statSync(claudeDir).isDirectory()) {
    return {
      targetId: ctx.targetId,
      configPath: MCP_JSON_REL,
      servers: [],
      deployedFiles: [],
      diagnostics: [
        {
          code: "CLAUDE_MCP_SKIP_NO_CLAUDE_DIR",
          message:
            "Skipping project MCP write: .claude/ directory is absent (Claude project-scope MCP is opt-in)",
        },
      ],
    };
  }

  if (!deployRoots.some((r) => r === "." || r === "./")) {
    throw new Error("claude configureMcp requires a registered '.' deploy root for .mcp.json");
  }

  const destFile = join(cwd, MCP_JSON_REL);
  assertUnderDeployRoots(cwd, destFile, deployRoots);
  if (basename(destFile) !== ".mcp.json") {
    throw new Error("claude configureMcp refuses non-.mcp.json root writes");
  }

  const existingDoc = readExistingMcpDoc(destFile);
  const existingServers =
    existingDoc.mcpServers && typeof existingDoc.mcpServers === "object"
      ? { ...(existingDoc.mcpServers as Record<string, Record<string, unknown>>) }
      : {};

  const { entries: incoming, diagnostics } = normalizeServerEntries(servers);
  const nextServers: Record<string, Record<string, unknown>> = { ...existingServers };

  const writtenNames: string[] = [];
  for (const [name, entry] of Object.entries(incoming)) {
    const prior = existingServers[name];
    nextServers[name] = prior && typeof prior === "object" ? { ...prior, ...entry } : { ...entry };
    // Drop portable / Copilot-only noise after shallow merge.
    delete nextServers[name]!.format;
    delete nextServers[name]!.packageName;
    delete nextServers[name]!.registry;
    writtenNames.push(name);
  }

  const doc: Record<string, unknown> = { ...existingDoc, mcpServers: nextServers };
  writeFileSync(destFile, `${JSON.stringify(doc, null, 2)}\n`, "utf8");

  return {
    targetId: ctx.targetId,
    configPath: MCP_JSON_REL,
    servers: writtenNames,
    deployedFiles: [{ path: MCP_JSON_REL }],
    diagnostics,
  };
}

function readExistingMcpDoc(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return raw && typeof raw === "object" && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};
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
    const entry = toClaudeServerEntry(server);
    if (!entry) {
      diagnostics.push({
        code: "CLAUDE_PORTABLE_MCP_UNSUPPORTED",
        message: `Claude cannot faithfully represent MCP server "${name}"`,
        server: name,
      });
      continue;
    }
    out[name] = entry;
  }
  return { entries: out, diagnostics };
}

function rewriteSkillLauncherCommand(command: string): string {
  if (command.startsWith(".agents/skills/")) {
    return `.claude/skills/${command.slice(".agents/skills/".length)}`;
  }
  if (command.startsWith("./.agents/skills/")) {
    return `./.claude/skills/${command.slice("./.agents/skills/".length)}`;
  }
  return command;
}

function toClaudeServerEntry(server: McpServerConfig): Record<string, unknown> | undefined {
  const transport = String(server.transport ?? server.type ?? "").toLowerCase();
  const entry: Record<string, unknown> = {};
  const portable = server.format === "agent-plugin";

  if (portable) {
    if (transport === "stdio") {
      if (typeof server.command !== "string") return undefined;
      entry.command = rewriteSkillLauncherCommand(server.command);
      if (Array.isArray(server.args)) entry.args = server.args;
      if (typeof server.cwd === "string") entry.cwd = server.cwd;
      entry.type = "stdio";
    } else if (transport === "streamable-http" || transport === "sse" || transport === "http") {
      if (typeof server.url !== "string") return undefined;
      entry.url = server.url;
      entry.type = transport === "sse" ? "sse" : "http";
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
    if (server.command) entry.command = rewriteSkillLauncherCommand(String(server.command));
    if (Array.isArray(server.args)) entry.args = server.args;
    entry.type = "stdio";
  }

  if (server.env && typeof server.env === "object") {
    entry.env = server.env;
  }

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
type SettingsDoc = {
  hooks?: Record<string, HookEntry[]>;
  [key: string]: unknown;
};

/**
 * Convert portable `applyTo` frontmatter to Claude `paths:` (omit when unconditional).
 */
export function transformClaudeRulesMarkdown(source: string): string {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return source;

  const rawFm = match[1] ?? "";
  const body = match[2] ?? "";
  const lines = rawFm.split(/\r?\n/);
  const kept: string[] = [];
  const paths: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const keyMatch = line.match(/^([A-Za-z0-9_-]+)\s*:(.*)$/);
    if (!keyMatch) {
      if (line.trim()) kept.push(line);
      i += 1;
      continue;
    }
    const key = keyMatch[1]!;
    const rest = keyMatch[2] ?? "";
    if (key === "applyTo" || key === "paths") {
      const inline = rest.trim();
      if (inline.startsWith("[") && inline.endsWith("]")) {
        for (const part of inline.slice(1, -1).split(",")) {
          const v = part.trim().replace(/^["']|["']$/g, "");
          if (v) paths.push(v);
        }
        i += 1;
        continue;
      }
      if (inline && inline !== "|" && inline !== ">") {
        paths.push(inline.replace(/^["']|["']$/g, ""));
        i += 1;
        continue;
      }
      i += 1;
      while (i < lines.length) {
        const item = lines[i]!;
        const listMatch = item.match(/^[ \t]*-[ \t]*(.+)$/);
        if (!listMatch) break;
        paths.push(listMatch[1]!.trim().replace(/^["']|["']$/g, ""));
        i += 1;
      }
      continue;
    }
    kept.push(line);
    i += 1;
  }

  const fmLines = [...kept];
  if (paths.length > 0) {
    fmLines.push("paths:");
    for (const p of paths) {
      fmLines.push(`  - ${JSON.stringify(p)}`);
    }
  }

  if (fmLines.length === 0) return body.replace(/\s+$/, "\n") || body;
  return `---\n${fmLines.join("\n")}\n---\n${body}`.replace(/\s+$/, "\n");
}

function materializeClaudeHooks(args: {
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

  const settingsPath = join(cwd, SETTINGS_JSON_REL);
  const ownershipPath = join(cwd, HOOKS_OWNERSHIP_REL);
  assertUnderDeployRoots(cwd, settingsPath, roots);
  assertUnderDeployRoots(cwd, ownershipPath, roots);
  mkdirSync(join(cwd, ".claude"), { recursive: true });

  const doc = readSettingsDoc(settingsPath);
  const ownership = readHookOwnershipSidecar(ownershipPath);

  if (doc.hooks && typeof doc.hooks === "object") {
    stripOwnedHookCommands(doc.hooks as Record<string, unknown>, ownership);
  }

  const nextOwned: HookOwnershipSidecar["owned"] = {};

  for (const p of hooks) {
    const name = sanitizeName(String(p.name));
    const srcPath = p.path ? resolve(p.path) : undefined;
    if (!srcPath || !existsSync(srcPath) || !statSync(srcPath).isFile()) {
      diagnostics.push({
        code: "CLAUDE_HOOK_SOURCE_MISSING",
        message: `Hook primitive "${p.name}" has no readable source JSON`,
        primitive: String(p.name),
      });
      continue;
    }

    let parsed: SettingsDoc;
    try {
      parsed = JSON.parse(readFileSync(srcPath, "utf8")) as SettingsDoc;
    } catch (cause) {
      diagnostics.push({
        code: "CLAUDE_HOOK_JSON_INVALID",
        message: `Hook "${p.name}" JSON is invalid: ${cause instanceof Error ? cause.message : String(cause)}`,
        primitive: String(p.name),
      });
      continue;
    }

    const sourceHooks = parsed.hooks && typeof parsed.hooks === "object" ? parsed.hooks : {};
    const ownedEntries: Array<{ event: string; command: string }> = [];
    const scripts: string[] = [];

    if (!doc.hooks || typeof doc.hooks !== "object") doc.hooks = {};

    for (const [event, entries] of Object.entries(sourceHooks)) {
      if (!Array.isArray(entries)) continue;
      const destList = Array.isArray(doc.hooks[event]) ? [...doc.hooks[event]!] : [];
      for (const entry of entries) {
        if (!entry || typeof entry !== "object") continue;
        const command = typeof entry.command === "string" ? entry.command.trim() : "";
        if (!command) {
          const { _apm_source: _drop, ...clean } = entry as HookEntry & { _apm_source?: unknown };
          void _drop;
          destList.push({ ...clean });
          continue;
        }

        const rewritten = copyHookScript({
          cwd,
          deployRoots: roots,
          hookFile: srcPath,
          command,
          alreadyDeployedNeedle: ".claude/",
          destRel: `.claude/hooks/${name}/${basename(command.replace(/^\.\//, ""))}`,
          commandAsDotSlash: true,
        });
        const { _apm_source: _drop, ...clean } = entry as HookEntry & { _apm_source?: unknown };
        void _drop;
        const nextEntry: HookEntry = { ...clean, command: rewritten.commandRel };
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

  writeFileSync(settingsPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  writeHookOwnershipSidecar(ownershipPath, { owned: nextOwned });

  deployedFiles.push({
    path: SETTINGS_JSON_REL,
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

function readSettingsDoc(path: string): SettingsDoc {
  if (!existsSync(path)) return { hooks: {} };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as SettingsDoc;
    if (!raw || typeof raw !== "object") return { hooks: {} };
    if (!raw.hooks || typeof raw.hooks !== "object") raw.hooks = {};
    return raw;
  } catch {
    return { hooks: {} };
  }
}
