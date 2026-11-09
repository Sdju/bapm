import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import type {
  AttributedPrimitive,
  BapmIntegration,
  CompileReport,
  ConfigureMcpContext,
  ConfigureMcpReport,
  ConfigureLspContext,
  ConfigureLspReport,
  LspServerConfig,
  MaterializeReport,
  McpServerConfig,
} from "@b-apm/integration-api";
import {
  SHARED_COMMAND_FRONTMATTER_KEYS,
  assertUnderDeployRoots,
  compilePrimitivesMarkdown,
  createMaterializeRun,
  filterFrontmatterKeys,
  frontmatterList,
  materializeSkill,
  mergeHookDeployment,
  mergeLspServers,
  mergeMcpServers,
  normalizeNamedEntries,
  parseFrontmatter,
  primitivesMaterialize,
  readJsonDocument,
  readPrimitiveContent,
  renderFrontmatter,
  writeDeployedFile,
  writeJsonDocument,
} from "@b-apm/integration-api";

const DEFAULT_DEPLOY_ROOTS = [".claude", "."] as const;
const MCP_JSON_REL = ".mcp.json";
const SETTINGS_JSON_REL = ".claude/settings.json";
const HOOKS_OWNERSHIP_REL = ".claude/bapm-hooks.json";
const LSP_PLUGIN_NAME = "apm-lsp";
const LSP_PLUGIN_REL = ".claude/skills/apm-lsp/.claude-plugin/plugin.json";

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
    detectGlobal: () => {
      const claudeDir = join(homedir(), ".claude");
      return existsSync(claudeDir) && statSync(claudeDir).isDirectory();
    },
    supportsGlobalFiles: true,
    globalCompileOutput: ".claude/CLAUDE.md",
    getDeployRoots: () => [...deployRoots],
    async compile(primitives, context): Promise<CompileReport> {
      return compilePrimitivesMarkdown(primitives, context, {
        title: "# CLAUDE.md",
        defaultOutput: "CLAUDE.md",
        instructions: "omit",
        outsideCwdMessage: "Claude compile output must be a cwd-relative file path",
      });
    },
    async materialize(primitives, ctx): Promise<MaterializeReport> {
      const run = createMaterializeRun({
        primitives,
        ctx,
        defaultDeployRoots: deployRoots,
        targetId: id,
        requiredRoots: [".claude"],
        label: "claude",
      });
      const { cwd, roots, deployedFiles, diagnostics } = run;
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

      return run.report();
    },
    async configureMcp(servers, ctx): Promise<ConfigureMcpReport> {
      if (ctx?.scope === "global") {
        throw new Error(
          "Claude global MCP is not supported in this release; use --only apm for global file primitives",
        );
      }
      return writeClaudeMcpConfig(servers, {
        cwd: resolve(ctx?.cwd ?? process.cwd()),
        deployRoots: ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots,
        targetId: ctx?.targetId ?? id,
        managedServers: ctx?.managedServers,
      });
    },
    async configureLsp(servers, ctx): Promise<ConfigureLspReport> {
      return writeClaudeLspConfig(servers, {
        cwd: resolve(ctx?.cwd ?? process.cwd()),
        deployRoots: ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots,
        targetId: ctx?.targetId ?? id,
        managedServers: ctx?.managedServers,
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
            "Skipping project MCP write for claude: .claude/ directory is absent (Claude project-scope MCP is opt-in; create .claude/ and re-run install)",
          target: ctx.targetId,
          dir: ".claude/",
          warn: true,
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

  const existingDoc = readJsonDocument({ path: destFile });

  const { entries: incoming, diagnostics } = normalizeServerEntries(servers);
  const merged = mergeMcpServers({
    document: existingDoc,
    key: "mcpServers",
    incoming,
    managedServers: ctx.managedServers,
    merge: "shallow",
    stripKeys: ["format", "packageName", "registry"],
  });
  writeJsonDocument(destFile, merged.document);

  return {
    targetId: ctx.targetId,
    configPath: MCP_JSON_REL,
    servers: merged.servers,
    deployedFiles: [{ path: MCP_JSON_REL }],
    diagnostics,
  };
}

/** Merge/write the APM-owned Claude LSP plugin manifest. */
function writeClaudeLspConfig(
  servers: LspServerConfig[] | Record<string, LspServerConfig>,
  ctx: ConfigureLspContext & { cwd: string; deployRoots: string[] },
): ConfigureLspReport {
  const destFile = join(ctx.cwd, LSP_PLUGIN_REL);
  const pluginDir = join(ctx.cwd, ".claude", "skills", "apm-lsp", ".claude-plugin");
  const skillDir = join(ctx.cwd, ".claude", "skills", "apm-lsp");

  const rawExisting = existsSync(destFile) ? readFileSync(destFile, "utf8") : undefined;
  const existing = parseLspJson(rawExisting, LSP_PLUGIN_REL);
  if (existing !== undefined) {
    const ownerName = typeof existing.name === "string" ? existing.name : "";
    if (ownerName !== LSP_PLUGIN_NAME) {
      throw new Error(
        `CLAUDE_LSP_OWNERSHIP: ${LSP_PLUGIN_REL} is owned by plugin ` +
          `'${ownerName || "(unnamed)"}', not bapm; remove it or repair the file`,
      );
    }
  }

  const incoming = normalizeLspEntries(servers);
  const merged = mergeLspServers({
    document: existing ?? {},
    key: "lspServers",
    incoming,
    managedServers: ctx.managedServers,
    ownershipLabel: "CLAUDE_LSP_OWNERSHIP",
    pathLabel: LSP_PLUGIN_REL,
  });
  const nextServers = merged.document.lspServers as Record<string, Record<string, unknown>>;
  const doc: Record<string, unknown> = {
    ...merged.document,
    name: LSP_PLUGIN_NAME,
  };
  const content = `${JSON.stringify(doc, null, 2)}\n`;
  const writtenNames = merged.servers;

  if (Object.keys(nextServers).length === 0 && onlyOwnedLspKeys(doc)) {
    if (existsSync(destFile)) {
      unlinkSync(destFile);
      for (const dir of [pluginDir, skillDir]) {
        try {
          rmdirSync(dir);
        } catch {
          break;
        }
      }
    }
    return {
      targetId: ctx.targetId,
      configPath: LSP_PLUGIN_REL,
      servers: writtenNames,
      deployedFiles: [],
    };
  }

  mkdirSync(pluginDir, { recursive: true });
  if (rawExisting !== content) writeFileSync(destFile, content, "utf8");

  return {
    targetId: ctx.targetId,
    configPath: LSP_PLUGIN_REL,
    servers: writtenNames,
    deployedFiles: [{ path: LSP_PLUGIN_REL }],
  };
}

function parseLspJson(raw: string | undefined, label: string): Record<string, unknown> | undefined {
  if (raw === undefined) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`CLAUDE_LSP_INVALID: ${label} must contain a JSON object`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`CLAUDE_LSP_INVALID: ${label} must contain a JSON object`);
  }
  return { ...(parsed as Record<string, unknown>) };
}

function onlyOwnedLspKeys(doc: Record<string, unknown>): boolean {
  return Object.keys(doc).every((key) => key === "name" || key === "lspServers");
}

function normalizeLspEntries(
  servers: LspServerConfig[] | Record<string, LspServerConfig>,
): Record<string, Record<string, unknown>> {
  const list: LspServerConfig[] = Array.isArray(servers)
    ? servers
    : Object.entries(servers).map(([name, value]) => ({ ...value, name: value.name ?? name }));
  const out: Record<string, Record<string, unknown>> = {};
  for (const server of list) {
    const name = String(server.name ?? "").trim();
    if (!name) throw new Error(`CLAUDE_LSP_INVALID: LSP server name must be non-empty`);
    const command = typeof server.command === "string" ? server.command.trim() : "";
    if (!command) {
      throw new Error(`CLAUDE_LSP_INVALID: LSP server "${name}" requires a stdio command`);
    }
    if (typeof server.url === "string" && server.url.trim()) {
      throw new Error(
        `CLAUDE_LSP_UNSUPPORTED: LSP server "${name}" uses url; only stdio command servers are supported`,
      );
    }
    const language =
      server.extensionToLanguage ?? server.fileExtensions ?? server.extension_to_language;
    if (!language || typeof language !== "object" || Array.isArray(language)) {
      throw new Error(`CLAUDE_LSP_INVALID: LSP server "${name}" requires extensionToLanguage`);
    }
    const entry: Record<string, unknown> = {
      command,
      extensionToLanguage: { ...language },
    };
    if (Array.isArray(server.args)) entry.args = [...server.args];
    if (server.env && typeof server.env === "object" && !Array.isArray(server.env)) {
      entry.env = { ...(server.env as Record<string, string>) };
    }
    for (const key of [
      "transport",
      "initializationOptions",
      "settings",
      "workspaceFolder",
      "startupTimeout",
      "shutdownTimeout",
      "restartOnCrash",
      "maxRestarts",
    ] as const) {
      const value = server[key];
      if (value !== undefined) entry[key] = value;
    }
    if (entry.startupTimeout === undefined && server.warmupTimeoutMs !== undefined) {
      entry.startupTimeout = server.warmupTimeoutMs;
    }
    out[name] = entry;
  }
  return out;
}

function normalizeServerEntries(servers: McpServerConfig[] | Record<string, McpServerConfig>): {
  entries: Record<string, Record<string, unknown>>;
  diagnostics: Array<{ code: string; message: string; server?: string }>;
} {
  const out: Record<string, Record<string, unknown>> = {};
  const diagnostics: Array<{ code: string; message: string; server?: string }> = [];

  for (const server of normalizeNamedEntries(servers)) {
    const entry = toClaudeServerEntry(server);
    if (!entry) {
      diagnostics.push({
        code: "CLAUDE_PORTABLE_MCP_UNSUPPORTED",
        message: `Claude cannot faithfully represent MCP server "${server.name}"`,
        server: server.name,
      });
      continue;
    }
    out[server.name] = entry;
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

/**
 * Convert portable `applyTo` frontmatter to Claude `paths:` (omit when unconditional).
 */
export function transformClaudeRulesMarkdown(source: string): string {
  const parsed = parseFrontmatter(source);
  if (!parsed.hasFrontmatter) return source;

  const kept: string[] = [...parsed.prelude];
  const paths: string[] = [];
  for (const field of parsed.fields) {
    if (field.key === "applyTo" || field.key === "paths") {
      paths.push(...frontmatterList(field));
      continue;
    }
    kept.push(...field.lines);
  }

  const fmLines = [...kept];
  if (paths.length > 0) {
    fmLines.push("paths:");
    for (const p of paths) {
      fmLines.push(`  - ${JSON.stringify(p)}`);
    }
  }

  return renderFrontmatter(fmLines, parsed.body);
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
  const settingsPath = join(cwd, SETTINGS_JSON_REL);
  const ownershipPath = join(cwd, HOOKS_OWNERSHIP_REL);
  assertUnderDeployRoots(cwd, settingsPath, roots);
  assertUnderDeployRoots(cwd, ownershipPath, roots);
  mkdirSync(join(cwd, ".claude"), { recursive: true });

  const result = mergeHookDeployment({
    cwd,
    deployRoots: roots,
    hooks,
    docPath: settingsPath,
    ownershipPath,
    docRel: SETTINGS_JSON_REL,
    ownershipRel: HOOKS_OWNERSHIP_REL,
    mode: "native-groups",
    code: "CLAUDE",
    defaultMatcher: "*",
    defaultHandlerType: true,
    alreadyDeployedNeedle: ".claude/",
    commandAsDotSlash: true,
    propagateVersion: false,
    scriptDestRel: ({ name, command }) =>
      `.claude/hooks/${name}/${basename(command.replace(/^\.\//, ""))}`,
  });

  return { deployedFiles: result.deployedFiles, diagnostics: result.diagnostics };
}
