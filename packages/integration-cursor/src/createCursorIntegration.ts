import { existsSync, mkdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
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
  SHARED_COMMAND_FRONTMATTER_KEYS,
  assertUnderDeployRoots,
  compilePrimitivesMarkdown,
  createMaterializeRun,
  filterFrontmatterKeys,
  materializeSkill,
  mergeHookDeployment,
  mergeMcpServers,
  normalizeNamedEntries,
  primitivesMaterialize,
  readJsonDocument,
  readPrimitiveContent,
  translateEnvMap,
  translateEnvReferences,
  writeDeployedFile,
  writeJsonDocument,
} from "@b-apm/integration-api";

const DEFAULT_DEPLOY_ROOTS = [".agents/skills", ".cursor"] as const;
const MCP_JSON_REL = ".cursor/mcp.json";
const HOOKS_JSON_REL = ".cursor/hooks.json";
const HOOKS_OWNERSHIP_REL = ".cursor/bapm-hooks.json";

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
    // Cursor expands ${env:VAR} at server start. Install must not bake APM
    // placeholders into the project-local config (APM 0.33+ #3116).
    mcpEnvMode: "translate",
    supportsGlobalMcp: true,
    supportsGlobalFiles: true,
    globalCompileOutput: ".cursor/AGENTS.md",
    detect: ({ cwd }) => {
      const cursorDir = join(cwd, ".cursor");
      if (existsSync(cursorDir) && statSync(cursorDir).isDirectory()) return true;
      const legacy = join(cwd, ".cursorrules");
      return existsSync(legacy) && statSync(legacy).isFile();
    },
    detectGlobal: () => {
      const cursorDir = join(homedir(), ".cursor");
      return existsSync(cursorDir) && statSync(cursorDir).isDirectory();
    },
    getDeployRoots: () => [...deployRoots],
    async compile(primitives, context): Promise<CompileReport> {
      return compilePrimitivesMarkdown(primitives, context, {
        title: "# AGENTS.md",
        defaultOutput: "AGENTS.md",
        outsideCwdMessage: "Cursor compile output must be a cwd-relative file path",
      });
    },
    async materialize(primitives, ctx): Promise<MaterializeReport> {
      // Global file materialize receives the user home as `ctx.cwd`, so the
      // same home-relative roots (`.cursor`, `.agents/skills`) are reused.
      const run = createMaterializeRun({
        primitives,
        ctx,
        defaultDeployRoots: deployRoots,
        targetId: id,
        requiredRoots: [".agents/skills", ".cursor"],
        label: "cursor",
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
        instruction(p, { name }) {
          deployedFiles.push(
            writeDeployedFile({
              cwd,
              deployRoots: roots,
              destRel: join(".cursor", "rules", `${name}.mdc`),
              content: readPrimitiveContent(p),
              primitive: { name: String(p.name), packageName: p.packageName },
            }),
          );
        },
        agent(p, { name }) {
          deployedFiles.push(
            writeDeployedFile({
              cwd,
              deployRoots: roots,
              destRel: join(".cursor", "agents", `${name}.md`),
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
              destRel: join(".cursor", "commands", `${name}.md`),
              content,
              primitive: { name: String(p.name), packageName: p.packageName },
            }),
          );
          if (droppedKeys.length > 0) {
            diagnostics.push({
              code: "CURSOR_COMMAND_FRONTMATTER_DROPPED",
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
        const hookDeployed = materializeCursorHooks({
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
      return writeCursorMcpConfig(servers, {
        cwd: resolve(ctx?.cwd ?? process.cwd()),
        deployRoots: ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots,
        targetId: ctx?.targetId ?? id,
        managedServers: ctx?.managedServers,
        scope: ctx?.scope,
      });
    },
  };
}

function writeCursorMcpConfig(
  servers: McpServerConfig[] | Record<string, McpServerConfig>,
  ctx: ConfigureMcpContext & { cwd: string; deployRoots: string[] },
): ConfigureMcpReport {
  const { cwd, deployRoots } = ctx;
  const globalScope = ctx.scope === "global";
  if (!globalScope && !deployRoots.some((r) => r === ".cursor" || r.startsWith(".cursor"))) {
    throw new Error("cursor configureMcp requires a registered .cursor deploy root");
  }

  const destFile = globalScope
    ? join(homedir(), ".cursor", "mcp.json")
    : join(cwd, ".cursor", "mcp.json");
  if (!globalScope) assertUnderDeployRoots(cwd, destFile, deployRoots);
  mkdirSync(dirname(destFile), { recursive: true });

  const existingDoc = readJsonDocument({ path: destFile });
  const { entries: incoming, diagnostics } = normalizeServerEntries(servers);
  const merged = mergeMcpServers({
    document: existingDoc,
    key: "mcpServers",
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
  } as ConfigureMcpReport;
}

function normalizeServerEntries(servers: McpServerConfig[] | Record<string, McpServerConfig>): {
  entries: Record<string, Record<string, unknown>>;
  diagnostics: Array<{ code: string; message: string; server?: string }>;
} {
  const out: Record<string, Record<string, unknown>> = {};
  const diagnostics: Array<{ code: string; message: string; server?: string }> = [];

  for (const server of normalizeNamedEntries(servers)) {
    const entry = toCursorServerEntry(server);
    if (!entry) {
      diagnostics.push({
        code: "CURSOR_PORTABLE_MCP_UNSUPPORTED",
        message: `Cursor cannot faithfully represent portable MCP server "${server.name}"`,
        server: server.name,
      });
      continue;
    }
    out[server.name] = entry;
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
      if (Array.isArray(server.args)) entry.args = translateCursorArgs(server.args);
      if (typeof server.cwd === "string") entry.cwd = server.cwd;
      entry.type = "stdio";
    } else if (transport === "streamable-http" || transport === "sse") {
      if (typeof server.url !== "string") return undefined;
      entry.url = server.url;
      entry.type = transport === "streamable-http" ? "http" : "sse";
    } else {
      return undefined;
    }
    if (server.env && typeof server.env === "object") {
      entry.env = translateEnvMap(server.env, "dollar-env");
    }
    const portableHeaders = translateHeaders(server.headers);
    if (portableHeaders) entry.headers = portableHeaders;
    return entry;
  }

  if (transport === "http" || transport === "sse" || typeof server.url === "string") {
    if (server.url) entry.url = server.url;
    if (transport) entry.type = transport === "sse" ? "sse" : "http";
  } else {
    // stdio default
    if (server.command) entry.command = server.command;
    if (Array.isArray(server.args)) entry.args = translateCursorArgs(server.args);
    entry.type = "stdio";
  }

  if (server.env && typeof server.env === "object") {
    entry.env = translateEnvMap(server.env, "dollar-env");
  }
  const headers = translateHeaders(server.headers);
  if (headers) entry.headers = headers;

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
        "headers",
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
 * Cursor resolves `${env:VAR}` at server start. Translate authored APM forms
 * (`${VAR}`, `${env:VAR}`, legacy `<VAR>`, OpenCode-native `{env:VAR}`) so no
 * resolved secret is written into `.cursor/mcp.json`.
 */
function translateCursorArgs(args: unknown[]): unknown[] {
  return args.map((arg) =>
    typeof arg === "string" ? translateEnvReferences(arg, "dollar-env") : arg,
  );
}

function translateHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) return undefined;
  return translateEnvMap(
    Object.fromEntries(
      Object.entries(headers).filter(([, value]) => typeof value === "string"),
    ) as Record<string, string>,
    "dollar-env",
  );
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
  const hooksPath = join(cwd, HOOKS_JSON_REL);
  const ownershipPath = join(cwd, HOOKS_OWNERSHIP_REL);
  assertUnderDeployRoots(cwd, hooksPath, roots);
  assertUnderDeployRoots(cwd, ownershipPath, roots);
  mkdirSync(join(cwd, ".cursor"), { recursive: true });

  const result = mergeHookDeployment({
    cwd,
    deployRoots: roots,
    hooks,
    docPath: hooksPath,
    ownershipPath,
    docRel: HOOKS_JSON_REL,
    ownershipRel: HOOKS_OWNERSHIP_REL,
    mode: "flat",
    code: "CURSOR",
    alreadyDeployedNeedle: ".cursor/",
    commandAsDotSlash: true,
    stripOwnershipKey: false,
    versionDefault: 1,
    scriptDestRel: ({ name, command }) =>
      `.cursor/hooks/${name}/${basename(command.replace(/^\.\//, ""))}`,
  });

  return { deployedFiles: result.deployedFiles, diagnostics: result.diagnostics };
}
