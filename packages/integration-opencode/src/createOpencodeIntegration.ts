import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type {
  BapmIntegration,
  CompileReport,
  ConfigureMcpContext,
  ConfigureMcpReport,
  MaterializeReport,
  McpServerConfig,
} from "@b-apm/integration-api";
import {
  assertUnderDeployRoots,
  compileMarkdownReport,
  materializeSkill,
  primitivesList,
  primitivesMaterialize,
  pruneManagedMcpServerNames,
  readPrimitiveContent,
  renderPrimitivesMarkdown,
  writeDeployedFile,
} from "@b-apm/integration-api";

const DEFAULT_DEPLOY_ROOTS = [".opencode", "."] as const;
const MCP_JSON_REL = "opencode.json";

/**
 * Create the OpenCode target.
 * Detect: `.opencode/` directory **or** `opencode.json` / `opencode.jsonc`
 * (lone `AGENTS.md` is not a signal).
 * Materialize: skills → `.opencode/skills/<name>/SKILL.md`,
 * agents → `.opencode/agents/<name>.md`,
 * commands → `.opencode/commands/<name>.md`,
 * instructions → skip (compile-only → `AGENTS.md`),
 * hooks → explicit non-fatal skip (not supported on OpenCode).
 * MCP: optional `configureMcp` writes project `opencode.json` (not via materialize).
 * Compile: project-root `AGENTS.md` including instructions (last-writer vs Cursor/Codex).
 */
export function createOpencodeIntegration(options?: {
  id?: string;
  deployRoots?: string[];
}): BapmIntegration {
  const id = options?.id ?? "opencode";
  const deployRoots = [...(options?.deployRoots ?? DEFAULT_DEPLOY_ROOTS)];

  return {
    id,
    deployRoots,
    // OpenCode expands `{env:VAR}` at runtime; never bake secrets into
    // project-root opencode.json (APM 0.33+).
    mcpEnvMode: "translate",
    supportsGlobalMcp: true,
    detect: ({ cwd }) => {
      const opencodeDir = join(cwd, ".opencode");
      if (existsSync(opencodeDir) && statSync(opencodeDir).isDirectory()) return true;
      const json = join(cwd, "opencode.json");
      if (existsSync(json) && statSync(json).isFile()) return true;
      const jsonc = join(cwd, "opencode.jsonc");
      return existsSync(jsonc) && statSync(jsonc).isFile();
    },
    detectGlobal: () => {
      const dir = resolveOpencodeGlobalConfigDir();
      if (existsSync(dir) && statSync(dir).isDirectory()) return true;
      return existsSync(join(dir, MCP_JSON_REL));
    },
    getDeployRoots: () => [...deployRoots],
    async compile(primitives, context): Promise<CompileReport> {
      const content = renderPrimitivesMarkdown({
        primitives: primitivesList(primitives),
        title: "# AGENTS.md",
      });
      return compileMarkdownReport({
        cwd: context.cwd,
        outputFile: context.outputFile ?? "AGENTS.md",
        write: context.write,
        content,
        requireBasename: "AGENTS.md",
        outsideCwdMessage: "OpenCode compile output must be a cwd-relative file path",
      });
    },
    async materialize(primitives, ctx): Promise<MaterializeReport> {
      if (ctx?.scope === "global") {
        throw new Error(
          "OpenCode global install does not deploy file primitives yet; global skills/rules are the next slice",
        );
      }
      const cwd = resolve(ctx?.cwd ?? process.cwd());
      const roots = ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots;
      if (!roots.some((r) => r === ".opencode" || r.startsWith(".opencode"))) {
        throw new Error("opencode target missing .opencode deploy root");
      }

      const deployedFiles: MaterializeReport["deployedFiles"] = [];
      const diagnostics: NonNullable<MaterializeReport["diagnostics"]> = [];

      await primitivesMaterialize(primitives, {
        skill(p, { name }) {
          deployedFiles.push(
            ...materializeSkill({
              primitive: p,
              cwd,
              deployRoots: roots,
              destDir: join(".opencode", "skills", name),
            }),
          );
        },
        instruction(p) {
          diagnostics.push({
            code: "OPENCODE_PRIMITIVE_UNSUPPORTED",
            message: `OpenCode does not materialize instruction primitives as host files (compile-only): "${p.name}"`,
            primitive: String(p.name),
            kind: "instruction",
          });
        },
        agent(p, { name }) {
          deployedFiles.push(
            writeDeployedFile({
              cwd,
              deployRoots: roots,
              destRel: join(".opencode", "agents", `${name}.md`),
              content: readPrimitiveContent(p),
              primitive: { name: String(p.name), packageName: p.packageName },
            }),
          );
        },
        command(p, { name }) {
          deployedFiles.push(
            writeDeployedFile({
              cwd,
              deployRoots: roots,
              destRel: join(".opencode", "commands", `${name}.md`),
              content: readPrimitiveContent(p),
              primitive: { name: String(p.name), packageName: p.packageName },
            }),
          );
        },
        hook(p) {
          diagnostics.push({
            code: "OPENCODE_HOOKS_UNSUPPORTED",
            message: `OpenCode does not support hooks; skipping hook "${p.name}" (not supported)`,
            primitive: String(p.name),
          });
        },
      });

      return {
        targetId: id,
        deployedFiles,
        ...(diagnostics.length > 0 ? { diagnostics } : {}),
      };
    },
    async configureMcp(servers, ctx): Promise<ConfigureMcpReport> {
      return writeOpencodeMcpConfig(servers, {
        cwd: resolve(ctx?.cwd ?? process.cwd()),
        deployRoots: ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots,
        targetId: ctx?.targetId ?? id,
        managedServers: ctx?.managedServers,
        scope: ctx?.scope,
      });
    },
  };
}

/**
 * OpenCode user config directory: `$XDG_CONFIG_HOME/opencode` or
 * `~/.config/opencode` (the documented global `opencode.json` location).
 */
function resolveOpencodeGlobalConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME?.trim();
  return join(xdg ? resolve(xdg) : join(homedir(), ".config"), "opencode");
}

function writeOpencodeMcpConfig(
  servers: McpServerConfig[] | Record<string, McpServerConfig>,
  ctx: ConfigureMcpContext & { cwd: string; deployRoots: string[] },
): ConfigureMcpReport {
  const { cwd, deployRoots } = ctx;
  const globalScope = ctx.scope === "global";
  if (!globalScope && !deployRoots.some((r) => r === "." || r === "./")) {
    throw new Error(
      "opencode configureMcp requires a registered '.' deploy root for opencode.json",
    );
  }

  const destFile = globalScope
    ? join(resolveOpencodeGlobalConfigDir(), MCP_JSON_REL)
    : join(cwd, MCP_JSON_REL);
  if (!globalScope) assertUnderDeployRoots(cwd, destFile, deployRoots);
  mkdirSync(dirname(destFile), { recursive: true });

  const existingDoc = readExistingOpencodeDoc(destFile);
  const existingMcp =
    existingDoc.mcp && typeof existingDoc.mcp === "object" && !Array.isArray(existingDoc.mcp)
      ? { ...(existingDoc.mcp as Record<string, Record<string, unknown>>) }
      : {};

  const { entries: incoming, diagnostics } = normalizeServerEntries(servers);
  const nextMcp: Record<string, Record<string, unknown>> = { ...existingMcp };

  const writtenNames: string[] = [];
  pruneManagedMcpServerNames(nextMcp, Object.keys(incoming), ctx.managedServers);
  for (const [name, entry] of Object.entries(incoming)) {
    nextMcp[name] = entry;
    writtenNames.push(name);
  }

  const doc: Record<string, unknown> = { ...existingDoc, mcp: nextMcp };
  writeFileSync(destFile, `${JSON.stringify(doc, null, 2)}\n`, "utf8");

  return {
    targetId: ctx.targetId,
    configPath: globalScope ? destFile : MCP_JSON_REL,
    servers: writtenNames,
    ...(globalScope ? {} : { deployedFiles: [{ path: MCP_JSON_REL }] }),
    diagnostics,
  };
}

function readExistingOpencodeDoc(path: string): Record<string, unknown> {
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
    const entry = toOpencodeServerEntry(server);
    if (!entry) {
      diagnostics.push({
        code: "OPENCODE_PORTABLE_MCP_UNSUPPORTED",
        message: `OpenCode cannot faithfully represent MCP server "${name}" (unsupported transport)`,
        server: name,
      });
      continue;
    }
    out[name] = entry;
  }
  return { entries: out, diagnostics };
}

function toOpencodeServerEntry(server: McpServerConfig): Record<string, unknown> | undefined {
  const transport = String(server.transport ?? server.type ?? "").toLowerCase();
  const portable = server.format === "agent-plugin";

  if (transport === "sse") {
    // OpenCode documents local/remote only — fail closed for SSE.
    return undefined;
  }

  if (portable) {
    if (transport === "stdio") {
      if (typeof server.command !== "string") return undefined;
      return buildLocalEntry(server);
    }
    if (transport === "streamable-http" || transport === "http") {
      if (typeof server.url !== "string") return undefined;
      return buildRemoteEntry(server);
    }
    return undefined;
  }

  if (transport === "http" || transport === "streamable-http" || typeof server.url === "string") {
    if (typeof server.url !== "string") return undefined;
    if (transport === "stdio") {
      // Prefer explicit stdio when both somehow present — unusual; treat as local.
      return buildLocalEntry(server);
    }
    return buildRemoteEntry(server);
  }

  if (transport === "stdio" || transport === "local" || typeof server.command === "string") {
    if (typeof server.command !== "string") return undefined;
    return buildLocalEntry(server);
  }

  return undefined;
}

function buildLocalEntry(server: McpServerConfig): Record<string, unknown> {
  const command = [String(server.command)];
  if (Array.isArray(server.args)) {
    for (const arg of server.args) command.push(translateOpencodePlaceholders(String(arg)));
  }
  const entry: Record<string, unknown> = { type: "local", command };
  const env = server.env ?? (server as { environment?: Record<string, string> }).environment;
  if (env && typeof env === "object") entry.environment = translateEnvPlaceholders(env);
  return entry;
}

function buildRemoteEntry(server: McpServerConfig): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    type: "remote",
    url: String(server.url),
  };
  const headers = server.headers;
  if (headers && typeof headers === "object" && !Array.isArray(headers)) {
    entry.headers = translateEnvPlaceholders(
      Object.fromEntries(
        Object.entries(headers).filter(([, value]) => typeof value === "string"),
      ) as Record<string, string>,
    );
  }
  return entry;
}

/**
 * OpenCode resolves `{env:VAR}` at runtime. Translate authored APM forms
 * (`${VAR}`, `${env:VAR}`, legacy `<VAR>`, Cursor-native `${env:VAR}`) so no
 * resolved secret is written into opencode.json.
 */
function translateOpencodePlaceholders(value: string): string {
  return value.replace(
    /\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}|\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\{env:([A-Za-z_][A-Za-z0-9_]*)\}|<([A-Z_][A-Z0-9_]*)>/g,
    (_match, native: string, bare: string, braceNative: string, angle: string) =>
      `{env:${native ?? bare ?? braceNative ?? angle}}`,
  );
}

function translateEnvPlaceholders(values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(values)) {
    out[key] = typeof raw === "string" ? translateOpencodePlaceholders(raw) : String(raw);
  }
  return out;
}
