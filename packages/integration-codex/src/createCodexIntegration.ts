import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import type {
  AttributedPrimitive,
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
  extractEnvReference,
  hasEnvReference,
  materializeSkill,
  mergeHookDeployment,
  normalizeHookEventName,
  primitivesMaterialize,
  pruneManagedMcpServerNames,
  readPrimitiveContent,
  writeDeployedFile,
} from "@b-apm/integration-api";

const DEFAULT_DEPLOY_ROOTS = [".codex", ".agents", "."] as const;
const MCP_TOML_REL = ".codex/config.toml";
const HOOKS_JSON_REL = ".codex/hooks.json";
const HOOKS_OWNERSHIP_REL = ".codex/bapm-hooks.json";
const AGENT_TOML_KEYS = new Set(["name", "description"]);

/**
 * Create the Codex CLI target.
 * Detect: project-root `.codex/` directory only (not lone `AGENTS.md`).
 * Materialize: skills → `.agents/skills/<name>/SKILL.md`,
 * agents → `.codex/agents/<name>.toml`,
 * instruction/command/prompt → skip (non-fatal diagnostics),
 * hooks → merge `.codex/hooks.json` (+ scripts / ownership sidecar).
 * MCP: `configureMcp` → `.codex/config.toml` `mcp_servers`.
 * Compile: project-root `AGENTS.md` including instructions (last-writer vs Cursor).
 */
export function createCodexIntegration(options?: {
  id?: string;
  deployRoots?: string[];
}): BapmIntegration {
  const id = options?.id ?? "codex";
  const deployRoots = [...(options?.deployRoots ?? DEFAULT_DEPLOY_ROOTS)];

  return {
    id,
    deployRoots,
    // Codex has no runtime interpolation for stdio `env`, so install still
    // bakes it. Header references are translated into native indirection.
    mcpHeadersEnvMode: "translate",
    detect: ({ cwd }) => {
      const codexDir = join(cwd, ".codex");
      return existsSync(codexDir) && statSync(codexDir).isDirectory();
    },
    detectGlobal: () => {
      const codexDir = join(homedir(), ".codex");
      return existsSync(codexDir) && statSync(codexDir).isDirectory();
    },
    supportsGlobalFiles: true,
    globalCompileOutput: ".codex/AGENTS.md",
    getDeployRoots: () => [...deployRoots],
    async compile(primitives, context): Promise<CompileReport> {
      return compilePrimitivesMarkdown(primitives, context, {
        title: "# AGENTS.md",
        defaultOutput: "AGENTS.md",
        requireBasename: "AGENTS.md",
        outsideCwdMessage: "Codex compile output must be a cwd-relative file path",
      });
    },
    async materialize(primitives, ctx): Promise<MaterializeReport> {
      const run = createMaterializeRun({
        primitives,
        ctx,
        defaultDeployRoots: deployRoots,
        targetId: id,
        requiredRoots: [".codex", ".agents"],
        label: "codex",
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
              destDir: join(".agents", "skills", name),
            }),
          );
        },
        instruction(p) {
          diagnostics.push({
            code: "CODEX_PRIMITIVE_UNSUPPORTED",
            message: `Codex does not materialize instruction primitives as host files (compile-only): "${p.name}"`,
            primitive: String(p.name),
            kind: "instruction",
          });
        },
        agent(p, { name }) {
          const result = materializeCodexAgent({ cwd, roots, primitive: p, name });
          deployedFiles.push(...result.deployedFiles);
          diagnostics.push(...result.diagnostics);
        },
        command(p) {
          diagnostics.push({
            code: "CODEX_PRIMITIVE_UNSUPPORTED",
            message: `Codex does not materialize command primitives as host files: "${p.name}"`,
            primitive: String(p.name),
            kind: "command",
          });
        },
        hook(p) {
          hookPrimitives.push(p);
        },
        unknown(p, { type }) {
          if (/prompt/i.test(type)) {
            diagnostics.push({
              code: "CODEX_PRIMITIVE_UNSUPPORTED",
              message: `Codex does not materialize prompt primitives as host files: "${p.name}"`,
              primitive: String(p.name),
              kind: "prompt",
            });
          }
        },
      });

      if (hookPrimitives.length > 0) {
        const hookDeployed = materializeCodexHooks({
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
          "Codex global MCP is not supported in this release; use --only apm for global file primitives",
        );
      }
      return writeCodexMcpConfig(servers, {
        cwd: resolve(ctx?.cwd ?? process.cwd()),
        deployRoots: ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots,
        targetId: ctx?.targetId ?? id,
        managedServers: ctx?.managedServers,
      });
    },
  };
}

function materializeCodexAgent(args: {
  cwd: string;
  roots: string[];
  primitive: AttributedPrimitive;
  name: string;
}): {
  deployedFiles: MaterializeReport["deployedFiles"];
  diagnostics: NonNullable<MaterializeReport["diagnostics"]>;
} {
  const { cwd, roots, primitive: p, name } = args;
  const source = readPrimitiveContent(p);
  const { doc, droppedKeys } = transformCodexAgentMarkdown(source, name);

  const diagnostics: NonNullable<MaterializeReport["diagnostics"]> = [];
  if (droppedKeys.length > 0) {
    diagnostics.push({
      code: "CODEX_AGENT_FRONTMATTER_DROPPED",
      message: `Dropped unsupported agent frontmatter keys for "${p.name}" (lossy): ${droppedKeys.join(", ")}`,
      primitive: String(p.name),
      droppedKeys,
    });
  }

  return {
    deployedFiles: [
      writeDeployedFile({
        cwd,
        deployRoots: roots,
        destRel: join(".codex", "agents", `${name}.toml`),
        content: stringifyToml(doc),
        primitive: { name: String(p.name), packageName: p.packageName },
      }),
    ],
    diagnostics,
  };
}

function transformCodexAgentMarkdown(
  source: string,
  fallbackName: string,
): { doc: Record<string, string>; droppedKeys: string[] } {
  let name = fallbackName;
  let description = "";
  let body = source;
  const droppedKeys: string[] = [];

  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (match) {
    body = match[2] ?? "";
    const rawFm = match[1] ?? "";
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
      if (key === "name" && rest) {
        name = rest.replace(/^["']|["']$/g, "");
        i += 1;
        continue;
      }
      if (key === "description") {
        if (rest && rest !== "|" && rest !== ">") {
          description = rest.replace(/^["']|["']$/g, "");
          i += 1;
          continue;
        }
        // Folded/block scalars: take following indented lines as description text.
        i += 1;
        const parts: string[] = [];
        while (i < lines.length) {
          const next = lines[i]!;
          if (/^[A-Za-z0-9_-]+\s*:/.test(next)) break;
          if (!next.trim()) {
            i += 1;
            break;
          }
          parts.push(next.trim());
          i += 1;
        }
        if (parts.length) description = parts.join(" ");
        continue;
      }
      if (!AGENT_TOML_KEYS.has(key)) {
        if (!droppedKeys.includes(key)) droppedKeys.push(key);
        // Skip list/block values under unsupported keys (e.g. tools:).
        i += 1;
        while (i < lines.length) {
          const next = lines[i]!;
          if (/^[A-Za-z0-9_-]+\s*:/.test(next)) break;
          if (!next.trim()) {
            i += 1;
            break;
          }
          if (/^[ \t]*-/.test(next) || /^[ \t]+/.test(next)) {
            i += 1;
            continue;
          }
          break;
        }
        continue;
      }
      i += 1;
    }
  }

  return {
    doc: {
      name,
      description,
      developer_instructions: body.trim(),
    },
    droppedKeys,
  };
}

function writeCodexMcpConfig(
  servers: McpServerConfig[] | Record<string, McpServerConfig>,
  ctx: ConfigureMcpContext & { cwd: string; deployRoots: string[] },
): ConfigureMcpReport {
  const { cwd, deployRoots } = ctx;
  if (!deployRoots.some((r) => r === ".codex" || r.startsWith(".codex"))) {
    throw new Error("codex configureMcp requires a registered .codex deploy root");
  }

  const destFile = join(cwd, MCP_TOML_REL);
  assertUnderDeployRoots(cwd, destFile, deployRoots);

  const existing = readExistingCodexToml(destFile);
  if (existing.status === "malformed") {
    return {
      targetId: ctx.targetId,
      configPath: MCP_TOML_REL,
      servers: [],
      deployedFiles: [],
      diagnostics: [
        {
          code: "CODEX_MCP_TOML_MALFORMED",
          message: `Skipping MCP write: ${MCP_TOML_REL} exists but cannot be parsed as TOML`,
        },
      ],
    };
  }

  const { entries: incoming, diagnostics } = normalizeCodexServerEntries(servers);
  const doc: Record<string, unknown> = { ...existing.doc };
  const mcpServers =
    doc.mcp_servers && typeof doc.mcp_servers === "object" && !Array.isArray(doc.mcp_servers)
      ? { ...(doc.mcp_servers as Record<string, unknown>) }
      : {};

  const writtenNames: string[] = [];
  pruneManagedMcpServerNames(mcpServers, Object.keys(incoming), ctx.managedServers);
  for (const [name, entry] of Object.entries(incoming)) {
    const prior = mcpServers[name];
    mcpServers[name] =
      prior && typeof prior === "object" && !Array.isArray(prior)
        ? { ...(prior as Record<string, unknown>), ...entry }
        : { ...entry };
    writtenNames.push(name);
  }
  doc.mcp_servers = mcpServers;

  mkdirSync(dirname(destFile), { recursive: true });
  writeFileSync(destFile, stringifyToml(doc), "utf8");

  return {
    targetId: ctx.targetId,
    configPath: MCP_TOML_REL,
    servers: writtenNames,
    deployedFiles: [{ path: MCP_TOML_REL }],
    diagnostics,
  };
}

function readExistingCodexToml(
  path: string,
): { status: "ok"; doc: Record<string, unknown> } | { status: "malformed" } {
  if (!existsSync(path)) return { status: "ok", doc: {} };
  try {
    const raw = parseToml(readFileSync(path, "utf8")) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { status: "malformed" };
    }
    return { status: "ok", doc: { ...(raw as Record<string, unknown>) } };
  } catch {
    return { status: "malformed" };
  }
}

function normalizeCodexServerEntries(
  servers: McpServerConfig[] | Record<string, McpServerConfig>,
): {
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
    const mapped = toCodexServerEntry(server);
    if (!mapped.ok) {
      diagnostics.push({
        code: mapped.code,
        message: mapped.message,
        server: name,
      });
      continue;
    }
    if (mapped.diagnostics) diagnostics.push(...mapped.diagnostics);
    out[name] = mapped.entry;
  }
  return { entries: out, diagnostics };
}

type CodexServerEntryResult =
  | {
      ok: true;
      entry: Record<string, unknown>;
      diagnostics?: Array<{ code: string; message: string; server?: string }>;
    }
  | { ok: false; code: string; message: string };

function toCodexServerEntry(server: McpServerConfig): CodexServerEntryResult {
  const transport = String(server.transport ?? server.type ?? "").toLowerCase();
  const name = String(server.name ?? "").trim() || "unknown";

  if (transport === "sse") {
    return {
      ok: false,
      code: "CODEX_MCP_SSE_UNSUPPORTED",
      message: `Codex rejects SSE MCP transport for server "${name}"`,
    };
  }

  const entry: Record<string, unknown> = {};

  if (
    transport === "streamable-http" ||
    transport === "http" ||
    (typeof server.url === "string" && transport !== "stdio")
  ) {
    if (typeof server.url !== "string" || !server.url.trim()) {
      return {
        ok: false,
        code: "CODEX_MCP_REMOTE_INVALID",
        message: `Codex remote MCP server "${name}" requires a url`,
      };
    }
    let parsed: URL;
    try {
      parsed = new URL(server.url);
    } catch {
      return {
        ok: false,
        code: "CODEX_MCP_REMOTE_INVALID",
        message: `Codex remote MCP server "${name}" has an invalid url`,
      };
    }
    if (parsed.protocol !== "https:") {
      return {
        ok: false,
        code: "CODEX_MCP_REMOTE_INVALID",
        message: `Codex remote MCP server "${name}" requires an https url`,
      };
    }
    entry.url = server.url;
    if (server.env && typeof server.env === "object") entry.env = server.env;
    const headerMapping = mapCodexHeaders(server.headers, name);
    if (headerMapping.httpHeaders) entry.http_headers = headerMapping.httpHeaders;
    if (headerMapping.envHttpHeaders) entry.env_http_headers = headerMapping.envHttpHeaders;
    if (headerMapping.bearerTokenEnvVar) {
      entry.bearer_token_env_var = headerMapping.bearerTokenEnvVar;
    }
    return {
      ok: true,
      entry,
      ...(headerMapping.diagnostics.length > 0 ? { diagnostics: headerMapping.diagnostics } : {}),
    };
  }

  // stdio default
  if (typeof server.command !== "string" || !server.command.trim()) {
    return {
      ok: false,
      code: "CODEX_MCP_STDIO_INVALID",
      message: `Codex stdio MCP server "${name}" requires a command`,
    };
  }
  entry.command = server.command;
  if (Array.isArray(server.args)) entry.args = server.args;
  if (server.env && typeof server.env === "object") entry.env = server.env;
  if (typeof server.cwd === "string") entry.cwd = server.cwd;
  return { ok: true, entry };
}

/**
 * Codex reads remote headers only as static `http_headers`, or through
 * `env_http_headers` / `bearer_token_env_var` for environment references.
 * Values with literal text around a reference cannot be expressed and are
 * skipped with a diagnostic rather than written as a static secret.
 */
function mapCodexHeaders(
  headers: Record<string, string> | undefined,
  serverName: string,
): {
  httpHeaders?: Record<string, string>;
  envHttpHeaders?: Record<string, string>;
  bearerTokenEnvVar?: string;
  diagnostics: Array<{ code: string; message: string; server?: string }>;
} {
  const httpHeaders: Record<string, string> = {};
  const envHttpHeaders: Record<string, string> = {};
  const diagnostics: Array<{ code: string; message: string; server?: string }> = [];
  let bearerTokenEnvVar: string | undefined;

  if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
    return { diagnostics };
  }

  for (const [header, raw] of Object.entries(headers)) {
    if (typeof raw !== "string") continue;
    if (!hasEnvReference(raw)) {
      httpHeaders[header] = raw;
      continue;
    }

    const bearer = /^Bearer\s+(.+)$/.exec(raw);
    if (bearer && header.toLowerCase() === "authorization") {
      const varName = extractEnvReference(bearer[1]!.trim());
      if (varName) {
        bearerTokenEnvVar = varName;
        continue;
      }
    }

    const direct = extractEnvReference(raw.trim());
    if (direct) {
      envHttpHeaders[header] = direct;
      continue;
    }

    diagnostics.push({
      code: "CODEX_MCP_HEADER_UNEXPRESSIBLE",
      message:
        `Codex cannot express header "${header}" for server "${serverName}" as a static value ` +
        "or environment reference; header skipped (remove surrounding text or use a plain ${VAR})",
      server: serverName,
    });
  }

  return {
    ...(Object.keys(httpHeaders).length > 0 ? { httpHeaders } : {}),
    ...(Object.keys(envHttpHeaders).length > 0 ? { envHttpHeaders } : {}),
    ...(bearerTokenEnvVar ? { bearerTokenEnvVar } : {}),
    diagnostics,
  };
}

function materializeCodexHooks(args: {
  cwd: string;
  roots: string[];
  hooks: AttributedPrimitive[];
}): {
  deployedFiles: MaterializeReport["deployedFiles"];
  diagnostics: NonNullable<MaterializeReport["diagnostics"]>;
} {
  const { cwd, roots, hooks } = args;
  const hooksPath = join(cwd, HOOKS_JSON_REL);
  const ownershipPath = join(cwd, HOOKS_OWNERSHIP_REL);
  assertUnderDeployRoots(cwd, hooksPath, roots);
  assertUnderDeployRoots(cwd, ownershipPath, roots);
  mkdirSync(join(cwd, ".codex"), { recursive: true });

  const result = mergeHookDeployment({
    cwd,
    deployRoots: roots,
    hooks,
    docPath: hooksPath,
    ownershipPath,
    docRel: HOOKS_JSON_REL,
    ownershipRel: HOOKS_OWNERSHIP_REL,
    mode: "native-groups",
    code: "CODEX",
    normalizeEvent: (event) => normalizeHookEventName(event, "pascal"),
    alreadyDeployedNeedle: ".codex/",
    commandAsDotSlash: true,
    versionDefault: 1,
    scriptDestRel: ({ name, command }) =>
      `.codex/hooks/${name}/${basename(command.replace(/^\.\//, ""))}`,
  });

  return { deployedFiles: result.deployedFiles, diagnostics: result.diagnostics };
}
