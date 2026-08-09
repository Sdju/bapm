import { cpSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
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
} from "@bapm/integration-api";
import {
  assertUnderDeployRoots,
  compileMarkdownReport,
  findPackageRoot,
  materializeSkill,
  primitivesList,
  primitivesMaterialize,
  readPrimitiveContent,
  renderPrimitivesMarkdown,
  sanitizeName,
  writeDeployedFile,
} from "@bapm/integration-api";

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
    detect: ({ cwd }) => {
      const codexDir = join(cwd, ".codex");
      return existsSync(codexDir) && statSync(codexDir).isDirectory();
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
        outsideCwdMessage: "Codex compile output must be a cwd-relative file path",
      });
    },
    async materialize(primitives, ctx): Promise<MaterializeReport> {
      const cwd = resolve(ctx?.cwd ?? process.cwd());
      const roots = ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots;
      if (!roots.some((r) => r === ".codex" || r.startsWith(".codex"))) {
        throw new Error("codex target missing .codex deploy root");
      }
      if (!roots.some((r) => r === ".agents" || r.startsWith(".agents"))) {
        throw new Error("codex target missing .agents deploy root");
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

      return {
        targetId: id,
        deployedFiles,
        ...(diagnostics.length > 0 ? { diagnostics } : {}),
      };
    },
    async configureMcp(servers, ctx): Promise<ConfigureMcpReport> {
      return writeCodexMcpConfig(servers, {
        cwd: resolve(ctx?.cwd ?? process.cwd()),
        deployRoots: ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots,
        targetId: ctx?.targetId ?? id,
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
    out[name] = mapped.entry;
  }
  return { entries: out, diagnostics };
}

function toCodexServerEntry(
  server: McpServerConfig,
): { ok: true; entry: Record<string, unknown> } | { ok: false; code: string; message: string } {
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
    return { ok: true, entry };
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

function materializeCodexHooks(args: {
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
  mkdirSync(join(cwd, ".codex"), { recursive: true });

  const doc = readHooksDoc(hooksPath);
  const ownership = readOwnershipSidecar(ownershipPath);
  stripOwnedEntries(doc, ownership);

  const nextOwned: OwnershipSidecar["owned"] = {};

  for (const p of hooks) {
    const name = sanitizeName(String(p.name));
    const srcPath = p.path ? resolve(p.path) : undefined;
    if (!srcPath || !existsSync(srcPath) || !statSync(srcPath).isFile()) {
      diagnostics.push({
        code: "CODEX_HOOK_SOURCE_MISSING",
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
        code: "CODEX_HOOK_JSON_INVALID",
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

    for (const [rawEvent, entries] of Object.entries(sourceHooks)) {
      if (!Array.isArray(entries)) continue;
      const event = normalizeCodexHookEvent(rawEvent);
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

/** Prefer PascalCase event names when normalizing (APM Codex expected casing). */
function normalizeCodexHookEvent(event: string): string {
  const trimmed = event.trim();
  if (!trimmed) return trimmed;
  if (/^[A-Z][A-Za-z0-9]*$/.test(trimmed)) return trimmed;
  return trimmed
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function copyHookScript(args: {
  cwd: string;
  roots: string[];
  hookName: string;
  hookFile: string;
  command: string;
}): { commandRel: string; scriptRel?: string } {
  const { cwd, roots, hookName, hookFile, command } = args;
  if (command.includes(".codex/")) {
    return { commandRel: command.startsWith("./") ? command : `./${command.replace(/^\//, "")}` };
  }

  const cleaned = command.replace(/^\.\//, "");
  const packageRoot = findPackageRoot(hookFile);
  const candidates = [resolve(dirname(hookFile), cleaned), resolve(packageRoot, cleaned)];
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

  const destRel = `.codex/hooks/${hookName}/${basename(source)}`;
  const destAbs = join(cwd, destRel);
  assertUnderDeployRoots(cwd, destAbs, roots);
  mkdirSync(dirname(destAbs), { recursive: true });
  cpSync(source, destAbs);
  return { commandRel: `./${destRel}`, scriptRel: destRel };
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
