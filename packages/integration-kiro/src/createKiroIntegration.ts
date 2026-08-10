import { cpSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
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
  assertUnderDeployRoots,
  compileMarkdownReport,
  findPackageRoot,
  materializeSkill,
  primitivesList,
  primitivesMaterialize,
  readHookOwnershipSidecar,
  readPrimitiveContent,
  removeOwnedHookArtifacts,
  renderPrimitivesMarkdown,
  sanitizeName,
  writeDeployedFile,
  writeHookOwnershipSidecar,
} from "@b-apm/integration-api";

const DEFAULT_DEPLOY_ROOTS = [".kiro", "."] as const;
const MCP_JSON_REL = ".kiro/settings/mcp.json";
const HOOKS_OWNERSHIP_REL = ".kiro/bapm-hooks.json";
const COMPILE_DEFAULT = "AGENTS.md";

/** Kiro custom-agent capability tags (APM KIRO_AGENT_ALLOWED_TOOLS). */
export const KIRO_AGENT_ALLOWED_TOOLS = new Set([
  "read",
  "write",
  "shell",
  "web",
  "subagent",
  "knowledge",
  "context",
  "todo_list",
  "@mcp",
  "@builtin",
  "*",
]);

const KIRO_EVENT_MAP: Record<string, string> = {
  PreToolUse: "PreToolUse",
  preToolUse: "PreToolUse",
  PostToolUse: "PostToolUse",
  postToolUse: "PostToolUse",
  UserPromptSubmit: "UserPromptSubmit",
  userPromptSubmit: "UserPromptSubmit",
  promptSubmit: "UserPromptSubmit",
  Stop: "Stop",
  stop: "Stop",
  AgentStop: "Stop",
  agentStop: "Stop",
  SessionStart: "SessionStart",
  sessionStart: "SessionStart",
  PreTaskExecution: "PreTaskExec",
  preTaskExecution: "PreTaskExec",
  PreTaskExec: "PreTaskExec",
  PostTaskExecution: "PostTaskExec",
  postTaskExecution: "PostTaskExec",
  PostTaskExec: "PostTaskExec",
  PostFileCreate: "PostFileCreate",
  PostFileSave: "PostFileSave",
  PostFileDelete: "PostFileDelete",
};

/**
 * Create the Kiro IDE/CLI v3 runtime target.
 * Detect: `.kiro/` directory (no mkdir).
 * Materialize: steering / agents / skills / v1 hooks under `.kiro/`; skip prompts/commands.
 * MCP: project `.kiro/settings/mcp.json` with translate placeholders (opt-in when `.kiro/` exists).
 * Compile: thin root `AGENTS.md`, omitting instruction primitives.
 */
export function createKiroIntegration(options?: {
  id?: string;
  deployRoots?: string[];
}): BapmIntegration {
  const id = options?.id ?? "kiro";
  const deployRoots = [...(options?.deployRoots ?? DEFAULT_DEPLOY_ROOTS)];

  return {
    id,
    deployRoots,
    mcpEnvMode: "translate",
    detect: ({ cwd }) => {
      const kiroDir = join(cwd, ".kiro");
      return existsSync(kiroDir) && statSync(kiroDir).isDirectory();
    },
    getDeployRoots: () => [...deployRoots],
    async compile(primitives, context): Promise<CompileReport> {
      const content = renderPrimitivesMarkdown({
        primitives: primitivesList(primitives),
        title: "# AGENTS.md",
        filter: (p) => !/instruction/i.test(String(p.type ?? "")),
      });
      return compileMarkdownReport({
        cwd: context.cwd,
        outputFile: context.outputFile ?? COMPILE_DEFAULT,
        write: context.write,
        content,
        outsideCwdMessage: "Kiro compile output must be a cwd-relative file path",
      });
    },
    async materialize(primitives, ctx): Promise<MaterializeReport> {
      const cwd = resolve(ctx?.cwd ?? process.cwd());
      const roots = ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots;
      if (!roots.some((r) => r === ".kiro" || r.startsWith(".kiro"))) {
        throw new Error("kiro target missing .kiro deploy root");
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
              destDir: join(".kiro", "skills", name),
            }),
          );
        },
        instruction(p, { name }) {
          deployedFiles.push(
            writeDeployedFile({
              cwd,
              deployRoots: roots,
              destRel: join(".kiro", "steering", `${name}.md`),
              content: transformKiroSteeringMarkdown(readPrimitiveContent(p)),
              primitive: { name: String(p.name), packageName: p.packageName },
            }),
          );
        },
        agent(p, { name }) {
          const result = renderKiroAgent(readPrimitiveContent(p), String(p.name));
          if (!result.ok) {
            diagnostics.push({
              code: "KIRO_AGENT_TOOLS_UNSUPPORTED",
              message: result.message,
              primitive: String(p.name),
            });
            return;
          }
          deployedFiles.push(
            writeDeployedFile({
              cwd,
              deployRoots: roots,
              destRel: join(".kiro", "agents", `${name}.md`),
              content: result.content,
              primitive: { name: String(p.name), packageName: p.packageName },
            }),
          );
        },
        command(p, { name }) {
          diagnostics.push({
            code: "KIRO_COMMAND_UNSUPPORTED",
            message: `Skipping command/prompt "${name}": Kiro does not receive prompts/commands (APM matrix N)`,
            primitive: String(p.name),
          });
        },
        hook(p) {
          hookPrimitives.push(p);
        },
        unknown(p, { name, type }) {
          if (/prompt/.test(type)) {
            diagnostics.push({
              code: "KIRO_COMMAND_UNSUPPORTED",
              message: `Skipping prompt-like primitive "${name}" (type ${type}): Kiro matrix N`,
              primitive: String(p.name),
            });
          }
        },
      });

      if (hookPrimitives.length > 0) {
        const hookDeployed = materializeKiroHooks({
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
      return writeKiroMcpConfig(servers, {
        cwd: resolve(ctx?.cwd ?? process.cwd()),
        deployRoots: ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots,
        targetId: ctx?.targetId ?? id,
      });
    },
  };
}

function writeKiroMcpConfig(
  servers: McpServerConfig[] | Record<string, McpServerConfig>,
  ctx: ConfigureMcpContext & { cwd: string; deployRoots: string[] },
): ConfigureMcpReport {
  const { cwd, deployRoots } = ctx;
  const kiroDir = join(cwd, ".kiro");
  if (!existsSync(kiroDir) || !statSync(kiroDir).isDirectory()) {
    return {
      targetId: ctx.targetId,
      configPath: MCP_JSON_REL,
      servers: [],
      deployedFiles: [],
      diagnostics: [
        {
          code: "KIRO_MCP_SKIP_NO_KIRO_DIR",
          message:
            "Skipping project MCP write: .kiro/ directory is absent (Kiro project-scope MCP is opt-in)",
        },
      ],
    };
  }

  const destFile = join(cwd, MCP_JSON_REL);
  assertUnderDeployRoots(cwd, destFile, deployRoots);
  mkdirSync(dirname(destFile), { recursive: true });

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
    const merged = prior && typeof prior === "object" ? { ...prior, ...entry } : { ...entry };
    delete merged.format;
    delete merged.packageName;
    delete merged.registry;
    nextServers[name] = merged;
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
    out[name] = toKiroServerEntry(server);
  }
  return { entries: out, diagnostics };
}

function translateEnvPlaceholders(env: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(env)) {
    if (typeof raw !== "string") {
      out[key] = String(raw);
      continue;
    }
    out[key] = raw
      .replace(/\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}/g, "${$1}")
      .replace(/<([A-Z_][A-Z0-9_]*)>/g, "${$1}");
  }
  return out;
}

function toKiroServerEntry(server: McpServerConfig): Record<string, unknown> {
  const transport = String(server.transport ?? server.type ?? "").toLowerCase();
  const entry: Record<string, unknown> = {};

  if (transport === "http" || transport === "sse" || typeof server.url === "string") {
    if (server.url) entry.url = server.url;
    if (transport) entry.type = transport === "sse" ? "sse" : "http";
  } else {
    if (server.command) entry.command = String(server.command);
    if (Array.isArray(server.args)) entry.args = server.args;
  }

  if (server.env && typeof server.env === "object") {
    entry.env = translateEnvPlaceholders(server.env);
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

/** Map instruction markdown to Kiro steering frontmatter. */
export function transformKiroSteeringMarkdown(source: string): string {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const applyToValues: string[] = [];
  let body = source;

  if (match) {
    const rawFm = match[1] ?? "";
    body = match[2] ?? "";
    const lines = rawFm.split(/\r?\n/);
    let i = 0;
    while (i < lines.length) {
      const line = lines[i]!;
      const keyMatch = line.match(/^([A-Za-z0-9_-]+)\s*:(.*)$/);
      if (!keyMatch) {
        i += 1;
        continue;
      }
      const key = keyMatch[1]!;
      const rest = (keyMatch[2] ?? "").trim();
      if (key !== "applyTo") {
        i += 1;
        continue;
      }
      if (rest.startsWith("[") && rest.endsWith("]")) {
        for (const part of rest.slice(1, -1).split(",")) {
          const v = part.trim().replace(/^["']|["']$/g, "");
          if (v) applyToValues.push(v);
        }
        i += 1;
        continue;
      }
      if (rest && rest !== "|" && rest !== ">") {
        for (const part of rest.split(",")) {
          const v = part.trim().replace(/^["']|["']$/g, "");
          if (v) applyToValues.push(v);
        }
        i += 1;
        continue;
      }
      i += 1;
      while (i < lines.length) {
        const item = lines[i]!;
        const listMatch = item.match(/^[ \t]*-[ \t]*(.+)$/);
        if (!listMatch) break;
        applyToValues.push(listMatch[1]!.trim().replace(/^["']|["']$/g, ""));
        i += 1;
      }
    }
  }

  const fmLines: string[] = [];
  if (applyToValues.length > 0) {
    fmLines.push("inclusion: fileMatch", "fileMatchPattern:");
    for (const pattern of applyToValues) {
      fmLines.push(`  - ${JSON.stringify(pattern)}`);
    }
  } else {
    fmLines.push("inclusion: always");
  }

  return `---\n${fmLines.join("\n")}\n---\n\n${body.replace(/^\n+/, "")}`;
}

function renderKiroAgent(
  source: string,
  primitiveName: string,
): { ok: true; content: string } | { ok: false; message: string } {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { ok: true, content: source };
  }

  const rawFm = match[1] ?? "";
  const body = match[2] ?? "";
  const fm = parseSimpleYamlMap(rawFm);
  if (fm === null) {
    return {
      ok: false,
      message: `Kiro agent "${primitiveName}": unparseable frontmatter — agent will not be deployed`,
    };
  }

  const out: Record<string, unknown> = {};
  if ("description" in fm && fm.description !== undefined && fm.description !== null) {
    out.description = fm.description;
  }
  if ("model" in fm && fm.model !== undefined && fm.model !== null) {
    out.model = fm.model;
  }

  if ("tools" in fm) {
    const toolsRaw = fm.tools;
    let toolsOut: string[] | undefined;
    if (toolsRaw === null || toolsRaw === undefined) {
      toolsOut = undefined;
    } else if (Array.isArray(toolsRaw)) {
      const toolsStrs = toolsRaw.map((t) => String(t).trim());
      const incompatible = toolsStrs.filter((t) => !KIRO_AGENT_ALLOWED_TOOLS.has(t));
      if (incompatible.length > 0) {
        return {
          ok: false,
          message: `Kiro agent "${primitiveName}": unsupported tool(s) ${incompatible
            .sort()
            .map((t) => JSON.stringify(t))
            .join(
              ", ",
            )} — agent will not be deployed. Use Kiro-approved tags (read, write, shell, web, subagent, knowledge, context, todo_list, @mcp, @builtin, *).`,
        };
      }
      toolsOut = toolsStrs;
    } else if (typeof toolsRaw === "string") {
      const tool = toolsRaw.trim();
      if (!KIRO_AGENT_ALLOWED_TOOLS.has(tool)) {
        return {
          ok: false,
          message: `Kiro agent "${primitiveName}": unsupported tool ${JSON.stringify(tool)} — agent will not be deployed`,
        };
      }
      toolsOut = [tool];
    } else {
      return {
        ok: false,
        message: `Kiro agent "${primitiveName}": 'tools' must be a list of capability tags — agent will not be deployed`,
      };
    }
    if (toolsOut !== undefined) out.tools = toolsOut;
  }

  if (Object.keys(out).length === 0) {
    return { ok: true, content: body };
  }

  const fmLines: string[] = [];
  if ("description" in out) fmLines.push(`description: ${yamlScalar(out.description)}`);
  if ("model" in out) fmLines.push(`model: ${yamlScalar(out.model)}`);
  if ("tools" in out && Array.isArray(out.tools)) {
    fmLines.push("tools:");
    for (const tool of out.tools) {
      fmLines.push(`  - ${yamlScalar(tool)}`);
    }
  }

  return { ok: true, content: `---\n${fmLines.join("\n")}\n---\n${body}` };
}

function yamlScalar(value: unknown): string {
  if (typeof value === "string") {
    if (/[:#{}[\],&*?|<>=!%@`]/.test(value) || value.includes("\n") || value.trim() !== value) {
      return JSON.stringify(value);
    }
    return value;
  }
  return JSON.stringify(value);
}

/** Minimal YAML map parser for agent frontmatter (scalars + string lists). */
function parseSimpleYamlMap(raw: string): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};
  const lines = raw.split(/\r?\n/);
  let i = 0;
  try {
    while (i < lines.length) {
      const line = lines[i]!;
      if (!line.trim() || line.trimStart().startsWith("#")) {
        i += 1;
        continue;
      }
      const keyMatch = line.match(/^([A-Za-z0-9_-]+)\s*:(.*)$/);
      if (!keyMatch) {
        i += 1;
        continue;
      }
      const key = keyMatch[1]!;
      const rest = (keyMatch[2] ?? "").trim();
      if (!rest || rest === "|" || rest === ">") {
        const items: string[] = [];
        i += 1;
        while (i < lines.length) {
          const item = lines[i]!;
          const listMatch = item.match(/^[ \t]*-[ \t]*(.+)$/);
          if (!listMatch) break;
          items.push(unquote(listMatch[1]!.trim()));
          i += 1;
        }
        result[key] = items;
        continue;
      }
      if (rest.startsWith("[") && rest.endsWith("]")) {
        result[key] = rest
          .slice(1, -1)
          .split(",")
          .map((p) => unquote(p.trim()))
          .filter(Boolean);
        i += 1;
        continue;
      }
      result[key] = unquote(rest);
      i += 1;
    }
  } catch {
    return null;
  }
  return result;
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function packageKey(p: AttributedPrimitive): string {
  if (typeof p.packageName === "string" && p.packageName.trim()) {
    return sanitizeName(p.packageName);
  }
  const source = String(p.source ?? "");
  if (source.startsWith("dependency:")) {
    return sanitizeName(source.slice("dependency:".length));
  }
  return "local";
}

function safeHookSlug(value: string, fallback = "hook"): string {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "");
  return safe || fallback;
}

function mapKiroEvent(event: string): string {
  return KIRO_EVENT_MAP[event] ?? event;
}

function materializeKiroHooks(args: {
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

  const ownershipPath = join(cwd, HOOKS_OWNERSHIP_REL);
  assertUnderDeployRoots(cwd, ownershipPath, roots);
  mkdirSync(join(cwd, ".kiro", "hooks"), { recursive: true });

  const ownership = readHookOwnershipSidecar(ownershipPath);
  removeOwnedHookArtifacts(cwd, ownership);

  const nextOwned: HookOwnershipSidecar["owned"] = {};

  for (const p of hooks) {
    const stem = sanitizeName(String(p.name));
    const pkg = packageKey(p);
    const srcPath = p.path ? resolve(p.path) : undefined;
    if (!srcPath || !existsSync(srcPath) || !statSync(srcPath).isFile()) {
      diagnostics.push({
        code: "KIRO_HOOK_SOURCE_MISSING",
        message: `Hook primitive "${p.name}" has no readable source JSON`,
        primitive: String(p.name),
      });
      continue;
    }

    let parsed: { hooks?: Record<string, unknown[]> };
    try {
      parsed = JSON.parse(readFileSync(srcPath, "utf8")) as { hooks?: Record<string, unknown[]> };
    } catch (cause) {
      diagnostics.push({
        code: "KIRO_HOOK_JSON_INVALID",
        message: `Hook "${p.name}" JSON is invalid: ${cause instanceof Error ? cause.message : String(cause)}`,
        primitive: String(p.name),
      });
      continue;
    }

    const sourceHooks = parsed.hooks && typeof parsed.hooks === "object" ? parsed.hooks : {};
    const hookFiles: string[] = [];
    const scripts: string[] = [];
    const perEventCounts: Record<string, number> = {};

    for (const [rawEvent, entries] of Object.entries(sourceHooks)) {
      if (!Array.isArray(entries)) continue;
      const eventName = mapKiroEvent(rawEvent);
      const eventSlug = safeHookSlug(eventName);

      for (const entry of entries) {
        if (!entry || typeof entry !== "object") continue;
        const handlers = extractHandlers(entry as Record<string, unknown>);
        const matcher = extractMatcher(entry as Record<string, unknown>);

        for (const handler of handlers) {
          const action = toKiroAction(handler);
          if (!action) continue;

          let commandRel: string | undefined;
          if (action.type === "command" && typeof action.command === "string") {
            const rewritten = copyHookScript({
              cwd,
              roots,
              pkg,
              hookFile: srcPath,
              command: action.command,
            });
            action.command = rewritten.commandRel;
            commandRel = rewritten.commandRel;
            if (rewritten.scriptRel) {
              scripts.push(rewritten.scriptRel);
              deployedFiles.push({
                path: rewritten.scriptRel,
                primitive: { name: String(p.name), packageName: p.packageName },
              });
            }
          }

          perEventCounts[eventName] = (perEventCounts[eventName] ?? 0) + 1;
          const index = perEventCounts[eventName]!;
          const filename = `${safeHookSlug(pkg)}-${safeHookSlug(stem)}-${eventSlug}-${index}.json`;
          const hookRel = `.kiro/hooks/${filename}`;
          const hookAbs = join(cwd, hookRel);
          assertUnderDeployRoots(cwd, hookAbs, roots);

          const doc: Record<string, unknown> = {
            version: "v1",
            hooks: [
              {
                name: `${pkg} ${eventName} ${index}`,
                trigger: eventName,
                ...(matcher ? { matcher } : {}),
                action,
              },
            ],
          };
          writeFileSync(hookAbs, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
          hookFiles.push(hookRel);
          deployedFiles.push({
            path: hookRel,
            primitive: { name: String(p.name), packageName: p.packageName },
          });
          void commandRel;
        }
      }
    }

    const ownedKey = `${pkg}-${stem}`;
    nextOwned[ownedKey] = {
      ...(p.packageName ? { packageName: p.packageName } : {}),
      hookFiles,
      scripts,
    };
  }

  writeHookOwnershipSidecar(ownershipPath, { owned: nextOwned });
  deployedFiles.push({
    path: HOOKS_OWNERSHIP_REL,
    ...(hooks[0]
      ? { primitive: { name: String(hooks[0].name), packageName: hooks[0].packageName } }
      : {}),
  });

  return { deployedFiles, diagnostics };
}

function extractHandlers(entry: Record<string, unknown>): Array<Record<string, unknown>> {
  const nested = entry.hooks;
  if (Array.isArray(nested)) {
    return nested.filter((h): h is Record<string, unknown> => !!h && typeof h === "object");
  }
  if (typeof entry.type === "string" || typeof entry.command === "string") {
    return [entry];
  }
  return [];
}

function extractMatcher(entry: Record<string, unknown>): string | undefined {
  if (typeof entry.matcher === "string" && entry.matcher.trim()) return entry.matcher.trim();
  const patterns = entry.patterns;
  if (typeof patterns === "string" && patterns.trim()) return patterns.trim();
  if (Array.isArray(patterns)) {
    const values = patterns.map((p) => String(p).trim()).filter(Boolean);
    return values.length > 0 ? values.join("|") : undefined;
  }
  return undefined;
}

function toKiroAction(handler: Record<string, unknown>): Record<string, unknown> | null {
  const type = typeof handler.type === "string" ? handler.type.toLowerCase() : "";
  if (typeof handler.command === "string" && handler.command.trim()) {
    const action: Record<string, unknown> = {
      type: "command",
      command: rewritePluginRoot(handler.command.trim()),
    };
    if (typeof handler.timeout === "number") action.timeout = handler.timeout;
    if (typeof handler.timeout_seconds === "number") action.timeout = handler.timeout_seconds;
    return action;
  }
  if (type === "askagent" || type === "agent") {
    const prompt = typeof handler.prompt === "string" ? handler.prompt.trim() : "";
    if (!prompt) return null;
    return { type: "agent", prompt };
  }
  return null;
}

function rewritePluginRoot(command: string): string {
  return command.replace(/\$\{PLUGIN_ROOT\}\//g, "").replace(/\$PLUGIN_ROOT\//g, "");
}

function copyHookScript(args: {
  cwd: string;
  roots: string[];
  pkg: string;
  hookFile: string;
  command: string;
}): { commandRel: string; scriptRel?: string } {
  const { cwd, roots, pkg, hookFile, command } = args;
  if (command.includes(".kiro/hooks/")) {
    return { commandRel: command.startsWith("./") ? command : command.replace(/^\//, "") };
  }

  const cleaned = command
    .replace(/^python3?\s+/, "")
    .replace(/^node\s+/, "")
    .replace(/^\.\//, "")
    .trim();
  const packageRoot = findPackageRoot(hookFile);
  const candidates = [
    resolve(dirname(hookFile), cleaned),
    resolve(packageRoot, cleaned),
    resolve(dirname(hookFile), command.replace(/^\.\//, "")),
    resolve(packageRoot, command.replace(/^\.\//, "")),
  ];

  // Prefer resolving the last path-looking token (e.g. python path/to/script.py).
  const tokens = command.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const t = token.replace(/^\.\//, "");
    if (t.includes("/") || /\.(py|js|mjs|cjs|sh|ts)$/.test(t)) {
      candidates.unshift(resolve(dirname(hookFile), t), resolve(packageRoot, t));
    }
  }

  const source = candidates.find((p) => {
    try {
      return existsSync(p) && statSync(p).isFile();
    } catch {
      return false;
    }
  });
  if (!source) {
    return { commandRel: command };
  }

  const relFromHookDir = relative(dirname(hookFile), source).replace(/\\/g, "/");
  const destRel = `.kiro/hooks/${pkg}/${relFromHookDir.startsWith("..") ? basename(source) : relFromHookDir}`;
  const destAbs = join(cwd, destRel);
  assertUnderDeployRoots(cwd, destAbs, roots);
  mkdirSync(dirname(destAbs), { recursive: true });
  cpSync(source, destAbs);

  const rewritten = command.replace(
    tokens.find(
      (t) =>
        resolve(dirname(hookFile), t.replace(/^\.\//, "")) === source ||
        resolve(packageRoot, t.replace(/^\.\//, "")) === source,
    ) ?? cleaned,
    destRel,
  );
  // Prefer a stable python/node + relative path form when the original had an interpreter.
  if (/^python3?\s+/.test(command) || /^node\s+/.test(command)) {
    const interp = command.split(/\s+/)[0]!;
    return { commandRel: `${interp} ${destRel}`, scriptRel: destRel };
  }
  return {
    commandRel: rewritten.includes(destRel) ? rewritten : destRel,
    scriptRel: destRel,
  };
}
