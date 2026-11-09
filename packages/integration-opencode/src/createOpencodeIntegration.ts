import { existsSync, mkdirSync, statSync } from "node:fs";
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
  compilePrimitivesMarkdown,
  createMaterializeRun,
  materializeSkill,
  mergeMcpServers,
  normalizeNamedEntries,
  primitivesMaterialize,
  readJsonDocument,
  readPrimitiveContent,
  resolveXdgConfigHome,
  translateEnvMap,
  translateEnvReferences,
  writeDeployedFile,
  writeJsonDocument,
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
      return compilePrimitivesMarkdown(primitives, context, {
        title: "# AGENTS.md",
        defaultOutput: "AGENTS.md",
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
      const run = createMaterializeRun({
        primitives,
        ctx,
        defaultDeployRoots: deployRoots,
        targetId: id,
        requiredRoots: [".opencode"],
        label: "opencode",
      });
      const { cwd, roots, deployedFiles, diagnostics } = run;

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

      return run.report();
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
  return join(resolveXdgConfigHome({ allowRelative: true }), "opencode");
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

  const existingDoc = readJsonDocument({ path: destFile });

  const { entries: incoming, diagnostics } = normalizeServerEntries(servers);
  const merged = mergeMcpServers({
    document: existingDoc,
    key: "mcp",
    incoming,
    managedServers: ctx.managedServers,
    merge: "replace",
  });
  writeJsonDocument(destFile, merged.document);

  return {
    targetId: ctx.targetId,
    configPath: globalScope ? destFile : MCP_JSON_REL,
    servers: merged.servers,
    ...(globalScope ? {} : { deployedFiles: [{ path: MCP_JSON_REL }] }),
    diagnostics,
  };
}

function normalizeServerEntries(servers: McpServerConfig[] | Record<string, McpServerConfig>): {
  entries: Record<string, Record<string, unknown>>;
  diagnostics: Array<{ code: string; message: string; server?: string }>;
} {
  const out: Record<string, Record<string, unknown>> = {};
  const diagnostics: Array<{ code: string; message: string; server?: string }> = [];

  for (const server of normalizeNamedEntries(servers)) {
    const entry = toOpencodeServerEntry(server);
    if (!entry) {
      diagnostics.push({
        code: "OPENCODE_PORTABLE_MCP_UNSUPPORTED",
        message: `OpenCode cannot faithfully represent MCP server "${server.name}" (unsupported transport)`,
        server: server.name,
      });
      continue;
    }
    out[server.name] = entry;
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
    for (const arg of server.args) command.push(translateEnvReferences(String(arg), "brace-env"));
  }
  const entry: Record<string, unknown> = { type: "local", command };
  const env = server.env ?? (server as { environment?: Record<string, string> }).environment;
  if (env && typeof env === "object") entry.environment = translateEnvMap(env, "brace-env");
  return entry;
}

function buildRemoteEntry(server: McpServerConfig): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    type: "remote",
    url: String(server.url),
  };
  const headers = server.headers;
  if (headers && typeof headers === "object" && !Array.isArray(headers)) {
    entry.headers = translateEnvMap(
      Object.fromEntries(
        Object.entries(headers).filter(([, value]) => typeof value === "string"),
      ) as Record<string, string>,
      "brace-env",
    );
  }
  return entry;
}
