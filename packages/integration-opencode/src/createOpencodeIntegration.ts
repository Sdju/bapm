import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
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
  materializeSkill,
  primitivesList,
  primitivesMaterialize,
  readPrimitiveContent,
  toPosixRel,
} from "@bapm/integration-api";

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
    detect: ({ cwd }) => {
      const opencodeDir = join(cwd, ".opencode");
      if (existsSync(opencodeDir) && statSync(opencodeDir).isDirectory()) return true;
      const json = join(cwd, "opencode.json");
      if (existsSync(json) && statSync(json).isFile()) return true;
      const jsonc = join(cwd, "opencode.jsonc");
      return existsSync(jsonc) && statSync(jsonc).isFile();
    },
    getDeployRoots: () => [...deployRoots],
    async compile(primitives, context): Promise<CompileReport> {
      return compileOpencodeAgentsMd(primitivesList(primitives), context);
    },
    async materialize(primitives, ctx): Promise<MaterializeReport> {
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
          const destFile = join(cwd, ".opencode", "agents", `${name}.md`);
          assertUnderDeployRoots(cwd, destFile, roots);
          mkdirSync(join(cwd, ".opencode", "agents"), { recursive: true });
          writeFileSync(destFile, readPrimitiveContent(p), "utf8");
          deployedFiles.push({
            path: toPosixRel(cwd, destFile),
            primitive: { name: String(p.name), packageName: p.packageName },
          });
        },
        command(p, { name }) {
          const destFile = join(cwd, ".opencode", "commands", `${name}.md`);
          assertUnderDeployRoots(cwd, destFile, roots);
          mkdirSync(join(cwd, ".opencode", "commands"), { recursive: true });
          writeFileSync(destFile, readPrimitiveContent(p), "utf8");
          deployedFiles.push({
            path: toPosixRel(cwd, destFile),
            primitive: { name: String(p.name), packageName: p.packageName },
          });
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
      });
    },
  };
}

function compileOpencodeAgentsMd(
  primitives: AttributedPrimitive[],
  context: CompileContext,
): CompileReport {
  const cwd = resolve(context.cwd);
  const outputFile = context.outputFile ?? "AGENTS.md";
  const outputPath = resolve(cwd, outputFile);
  const rel = relative(cwd, outputPath);
  if (!rel || rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    throw new Error("OpenCode compile output must be a cwd-relative file path");
  }
  if (basename(outputPath) !== "AGENTS.md") {
    throw new Error("OpenCode compile output basename must be AGENTS.md");
  }

  const content = renderOpencodeAgentsMd(primitives);
  const wrote = context.write;
  if (wrote) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, content, "utf8");
  }

  return { path: rel.replace(/\\/g, "/"), content, wrote };
}

function renderOpencodeAgentsMd(primitives: AttributedPrimitive[]): string {
  // Include instructions (compile-only path). Shared AGENTS.md with Cursor/Codex: last writer wins.
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

function writeOpencodeMcpConfig(
  servers: McpServerConfig[] | Record<string, McpServerConfig>,
  ctx: ConfigureMcpContext & { cwd: string; deployRoots: string[] },
): ConfigureMcpReport {
  const { cwd, deployRoots } = ctx;
  if (!deployRoots.some((r) => r === "." || r === "./")) {
    throw new Error(
      "opencode configureMcp requires a registered '.' deploy root for opencode.json",
    );
  }

  const destFile = join(cwd, MCP_JSON_REL);
  assertUnderDeployRoots(cwd, destFile, deployRoots);

  const existingDoc = readExistingOpencodeDoc(destFile);
  const existingMcp =
    existingDoc.mcp && typeof existingDoc.mcp === "object" && !Array.isArray(existingDoc.mcp)
      ? { ...(existingDoc.mcp as Record<string, Record<string, unknown>>) }
      : {};

  const { entries: incoming, diagnostics } = normalizeServerEntries(servers);
  const nextMcp: Record<string, Record<string, unknown>> = { ...existingMcp };

  const writtenNames: string[] = [];
  for (const [name, entry] of Object.entries(incoming)) {
    nextMcp[name] = entry;
    writtenNames.push(name);
  }

  const doc: Record<string, unknown> = { ...existingDoc, mcp: nextMcp };
  writeFileSync(destFile, `${JSON.stringify(doc, null, 2)}\n`, "utf8");

  return {
    targetId: ctx.targetId,
    configPath: MCP_JSON_REL,
    servers: writtenNames,
    deployedFiles: [{ path: MCP_JSON_REL }],
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
    for (const arg of server.args) command.push(String(arg));
  }
  const entry: Record<string, unknown> = { type: "local", command };
  const env = server.env ?? (server as { environment?: Record<string, string> }).environment;
  if (env && typeof env === "object") entry.environment = env;
  return entry;
}

function buildRemoteEntry(server: McpServerConfig): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    type: "remote",
    url: String(server.url),
  };
  const headers = server.headers;
  if (headers && typeof headers === "object" && !Array.isArray(headers)) {
    entry.headers = headers;
  }
  return entry;
}
