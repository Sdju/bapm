import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
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
  findPackageRoot,
  materializeSkill,
  primitivesList,
  primitivesMaterialize,
  readPrimitiveContent,
  sanitizeName,
  toPosixRel,
} from "@bapm/integration-api";

const DEFAULT_DEPLOY_ROOTS = [".agents", "."] as const;
const MCP_JSON_REL = ".agents/mcp_config.json";
const HOOKS_JSON_REL = ".agents/hooks.json";
const HOOKS_OWNERSHIP_REL = ".agents/bapm-hooks.json";
const BAPM_HOOK_CONTAINER = "bapm";
/** Antigravity nested matcher/hooks[] events (APM hook_native_formats). */
const NESTED_EVENTS = new Set(["PreToolUse", "PostToolUse"]);

/**
 * Create the Antigravity CLI (agy) target.
 * Detect: always false (explicit-only; shared `.agents/` is not a signal).
 * Materialize: instructions → `.agents/rules/` (trigger/globs),
 * skills → `.agents/skills/`, hooks → `.agents/hooks.json` (agy schema),
 * agents/commands → skip.
 * MCP: opt-in `.agents/mcp_config.json` when `.agents/` exists (`serverUrl` for remotes).
 * Compile: project-root `AGENTS.md`, omitting instruction primitives.
 */
export function createAntigravityIntegration(options?: {
  id?: string;
  deployRoots?: string[];
}): BapmIntegration {
  const id = options?.id ?? "antigravity";
  const deployRoots = [...(options?.deployRoots ?? DEFAULT_DEPLOY_ROOTS)];

  return {
    id,
    deployRoots,
    detect: () => false,
    getDeployRoots: () => [...deployRoots],
    async compile(primitives, context): Promise<CompileReport> {
      return compileAntigravityAgentsMd(primitivesList(primitives), context);
    },
    async materialize(primitives, ctx): Promise<MaterializeReport> {
      const cwd = resolve(ctx?.cwd ?? process.cwd());
      const roots = ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots;
      if (!roots.some((r) => r === ".agents" || r.startsWith(".agents"))) {
        throw new Error("antigravity target missing .agents deploy root");
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
        instruction(p, { name }) {
          const destFile = join(cwd, ".agents", "rules", `${name}.md`);
          assertUnderDeployRoots(cwd, destFile, roots);
          mkdirSync(join(cwd, ".agents", "rules"), { recursive: true });
          writeFileSync(
            destFile,
            transformAntigravityRulesMarkdown(readPrimitiveContent(p)),
            "utf8",
          );
          deployedFiles.push({
            path: toPosixRel(cwd, destFile),
            primitive: { name: String(p.name), packageName: p.packageName },
          });
        },
        agent(p) {
          diagnostics.push({
            code: "ANTIGRAVITY_PRIMITIVE_UNSUPPORTED",
            message: `Antigravity does not materialize agent primitives: "${p.name}"`,
            primitive: String(p.name),
            kind: "agent",
          });
        },
        command(p) {
          diagnostics.push({
            code: "ANTIGRAVITY_PRIMITIVE_UNSUPPORTED",
            message: `Antigravity does not materialize command primitives: "${p.name}"`,
            primitive: String(p.name),
            kind: "command",
          });
        },
        hook(p) {
          hookPrimitives.push(p);
        },
      });

      if (hookPrimitives.length > 0) {
        const hookDeployed = materializeAntigravityHooks({
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
      return writeAntigravityMcpConfig(servers, {
        cwd: resolve(ctx?.cwd ?? process.cwd()),
        deployRoots: ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots,
        targetId: ctx?.targetId ?? id,
      });
    },
  };
}

/**
 * Map portable `applyTo` frontmatter to Antigravity `trigger: glob` + `globs`.
 */
export function transformAntigravityRulesMarkdown(source: string): string {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return source;

  const rawFm = match[1] ?? "";
  const body = match[2] ?? "";
  const lines = rawFm.split(/\r?\n/);
  const kept: string[] = [];
  const globs: string[] = [];
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
    if (key === "applyTo" || key === "globs" || key === "trigger") {
      if (key === "trigger") {
        i += 1;
        continue;
      }
      const inline = rest.trim();
      if (inline.startsWith("[") && inline.endsWith("]")) {
        for (const part of inline.slice(1, -1).split(",")) {
          const v = part.trim().replace(/^["']|["']$/g, "");
          if (v) globs.push(v);
        }
        i += 1;
        continue;
      }
      if (inline && inline !== "|" && inline !== ">") {
        for (const part of inline.replace(/^["']|["']$/g, "").split(",")) {
          const v = part.trim().replace(/^["']|["']$/g, "");
          if (v) globs.push(v);
        }
        i += 1;
        continue;
      }
      i += 1;
      while (i < lines.length) {
        const item = lines[i]!;
        const listMatch = item.match(/^[ \t]*-[ \t]*(.+)$/);
        if (!listMatch) break;
        globs.push(listMatch[1]!.trim().replace(/^["']|["']$/g, ""));
        i += 1;
      }
      continue;
    }
    kept.push(line);
    i += 1;
  }

  const fmLines = [...kept];
  if (globs.length > 0) {
    fmLines.push("trigger: glob");
    if (globs.length === 1) {
      fmLines.push(`globs: ${JSON.stringify(globs[0])}`);
    } else {
      fmLines.push("globs:");
      for (const g of globs) {
        fmLines.push(`  - ${JSON.stringify(g)}`);
      }
    }
  }

  if (fmLines.length === 0) return body.replace(/\s+$/, "\n") || body;
  return `---\n${fmLines.join("\n")}\n---\n${body}`.replace(/\s+$/, "\n");
}

function compileAntigravityAgentsMd(
  primitives: AttributedPrimitive[],
  context: CompileContext,
): CompileReport {
  const cwd = resolve(context.cwd);
  const outputFile = context.outputFile ?? "AGENTS.md";
  const outputPath = resolve(cwd, outputFile);
  const rel = relative(cwd, outputPath);
  if (!rel || rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    throw new Error("Antigravity compile output must be a cwd-relative file path");
  }

  const content = renderAntigravityAgentsMd(primitives);
  const wrote = context.write;
  if (wrote) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, content, "utf8");
  }

  return { path: rel.replace(/\\/g, "/"), content, wrote };
}

function renderAntigravityAgentsMd(primitives: AttributedPrimitive[]): string {
  const filtered = primitives.filter((p) => !/instruction/i.test(String(p.type ?? "")));
  const sorted = [...filtered].sort((a, b) => {
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

function writeAntigravityMcpConfig(
  servers: McpServerConfig[] | Record<string, McpServerConfig>,
  ctx: ConfigureMcpContext & { cwd: string; deployRoots: string[] },
): ConfigureMcpReport {
  const { cwd, deployRoots } = ctx;
  const agentsDir = join(cwd, ".agents");
  if (!existsSync(agentsDir) || !statSync(agentsDir).isDirectory()) {
    return {
      targetId: ctx.targetId,
      configPath: MCP_JSON_REL,
      servers: [],
      deployedFiles: [],
      diagnostics: [
        {
          code: "ANTIGRAVITY_MCP_SKIP_NO_AGENTS_DIR",
          message:
            "Skipping project MCP write: .agents/ directory is absent (Antigravity project-scope MCP is opt-in)",
        },
      ],
    };
  }

  if (!deployRoots.some((r) => r === ".agents" || r.startsWith(".agents"))) {
    throw new Error("antigravity configureMcp requires a registered .agents deploy root");
  }

  const destFile = join(cwd, MCP_JSON_REL);
  assertUnderDeployRoots(cwd, destFile, deployRoots);
  mkdirSync(agentsDir, { recursive: true });

  const existingDoc = readExistingJsonDoc(destFile);
  const existingServers =
    existingDoc.mcpServers && typeof existingDoc.mcpServers === "object"
      ? { ...(existingDoc.mcpServers as Record<string, Record<string, unknown>>) }
      : {};

  const { entries: incoming, diagnostics } = normalizeServerEntries(servers);
  const nextServers: Record<string, Record<string, unknown>> = { ...existingServers };
  const writtenNames: string[] = [];
  for (const [name, entry] of Object.entries(incoming)) {
    nextServers[name] = { ...entry };
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

function readExistingJsonDoc(path: string): Record<string, unknown> {
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
    const entry = toAntigravityServerEntry(server);
    if (!entry) {
      diagnostics.push({
        code: "ANTIGRAVITY_MCP_UNSUPPORTED",
        message: `Antigravity cannot faithfully represent MCP server "${name}"`,
        server: name,
      });
      continue;
    }
    out[name] = entry;
  }
  return { entries: out, diagnostics };
}

function toAntigravityServerEntry(server: McpServerConfig): Record<string, unknown> | undefined {
  const transport = String(server.transport ?? server.type ?? "").toLowerCase();
  const entry: Record<string, unknown> = {};
  const remoteUrl =
    typeof server.url === "string"
      ? server.url
      : typeof (server as { httpUrl?: unknown }).httpUrl === "string"
        ? String((server as { httpUrl?: string }).httpUrl)
        : typeof (server as { serverUrl?: unknown }).serverUrl === "string"
          ? String((server as { serverUrl?: string }).serverUrl)
          : undefined;

  if (
    remoteUrl &&
    (transport === "http" ||
      transport === "sse" ||
      transport === "streamable-http" ||
      !server.command)
  ) {
    entry.serverUrl = remoteUrl;
  } else if (server.command) {
    entry.command = server.command;
    if (Array.isArray(server.args)) entry.args = server.args;
  } else {
    return undefined;
  }

  if (server.env && typeof server.env === "object") entry.env = server.env;

  for (const [key, value] of Object.entries(server)) {
    if (
      [
        "name",
        "transport",
        "type",
        "command",
        "args",
        "url",
        "httpUrl",
        "serverUrl",
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

type HookHandler = { type?: string; command?: string; timeout?: number; [key: string]: unknown };
type NestedHookGroup = { matcher?: string; hooks: HookHandler[]; [key: string]: unknown };
type AgyEventValue = NestedHookGroup[] | HookHandler[];
type AgyHooksDoc = Record<string, unknown>;
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

function materializeAntigravityHooks(args: {
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
  mkdirSync(join(cwd, ".agents"), { recursive: true });

  const doc = readAgyHooksDoc(hooksPath);
  const ownership = readOwnershipSidecar(ownershipPath);
  cleanupOwnedScripts(cwd, ownership);
  delete doc[BAPM_HOOK_CONTAINER];

  const container: Record<string, AgyEventValue> = {};
  const nextOwned: OwnershipSidecar["owned"] = {};

  for (const p of hooks) {
    const name = sanitizeName(String(p.name));
    const pkg = sanitizeName(String(p.packageName ?? p.name));
    const srcPath = p.path ? resolve(p.path) : undefined;
    if (!srcPath || !existsSync(srcPath) || !statSync(srcPath).isFile()) {
      diagnostics.push({
        code: "ANTIGRAVITY_HOOK_SOURCE_MISSING",
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
        code: "ANTIGRAVITY_HOOK_JSON_INVALID",
        message: `Hook "${p.name}" JSON is invalid: ${cause instanceof Error ? cause.message : String(cause)}`,
        primitive: String(p.name),
      });
      continue;
    }

    const sourceHooks = parsed.hooks && typeof parsed.hooks === "object" ? parsed.hooks : {};
    const ownedEntries: Array<{ event: string; command: string }> = [];
    const scripts: string[] = [];

    for (const [rawEvent, entries] of Object.entries(sourceHooks)) {
      if (!Array.isArray(entries)) continue;
      const event = normalizeAgyHookEvent(rawEvent);
      const converted = toAgyEventEntries(event, entries, {
        cwd,
        roots,
        pkg,
        hookFile: srcPath,
        ownedEntries,
        scripts,
        deployedFiles,
        primitive: p,
      });
      const prior = container[event];
      if (Array.isArray(prior)) {
        (prior as unknown[]).push(...(converted as unknown[]));
      } else {
        container[event] = converted;
      }
    }

    nextOwned[name] = {
      ...(p.packageName ? { packageName: p.packageName } : {}),
      entries: ownedEntries,
      scripts,
    };
  }

  doc[BAPM_HOOK_CONTAINER] = container;
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

function toAgyEventEntries(
  event: string,
  entries: unknown[],
  ctx: {
    cwd: string;
    roots: string[];
    pkg: string;
    hookFile: string;
    ownedEntries: Array<{ event: string; command: string }>;
    scripts: string[];
    deployedFiles: MaterializeReport["deployedFiles"];
    primitive: AttributedPrimitive;
  },
): AgyEventValue {
  const nested = NESTED_EVENTS.has(event);
  if (nested) {
    const groups: NestedHookGroup[] = [];
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;
      const obj = entry as Record<string, unknown>;
      if (Array.isArray(obj.hooks)) {
        const handlers = obj.hooks
          .filter((h): h is Record<string, unknown> => !!h && typeof h === "object")
          .map((h) => rewriteHandler(h, event, ctx));
        const group: NestedHookGroup = { hooks: handlers };
        if (typeof obj.matcher === "string") group.matcher = obj.matcher;
        groups.push(group);
      } else {
        groups.push({ hooks: [rewriteHandler(obj, event, ctx)] });
      }
    }
    return groups;
  }

  const flat: HookHandler[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    if (Array.isArray(obj.hooks)) {
      for (const h of obj.hooks) {
        if (h && typeof h === "object")
          flat.push(rewriteHandler(h as Record<string, unknown>, event, ctx));
      }
    } else {
      flat.push(rewriteHandler(obj, event, ctx));
    }
  }
  return flat;
}

function rewriteHandler(
  handler: Record<string, unknown>,
  event: string,
  ctx: {
    cwd: string;
    roots: string[];
    pkg: string;
    hookFile: string;
    ownedEntries: Array<{ event: string; command: string }>;
    scripts: string[];
    deployedFiles: MaterializeReport["deployedFiles"];
    primitive: AttributedPrimitive;
  },
): HookHandler {
  const next: HookHandler = { ...handler };
  delete next.timeoutSec;
  delete next._apm_source;
  delete next._bapm_source;

  const timeoutSec =
    typeof handler.timeoutSec === "number"
      ? handler.timeoutSec
      : typeof handler.timeout === "number"
        ? handler.timeout
        : undefined;
  if (timeoutSec !== undefined) next.timeout = timeoutSec;

  const command = typeof handler.command === "string" ? handler.command.trim() : "";
  if (command) {
    const rewritten = copyHookScript({
      cwd: ctx.cwd,
      roots: ctx.roots,
      pkg: ctx.pkg,
      hookFile: ctx.hookFile,
      command,
    });
    next.command = rewritten.commandRel;
    ctx.ownedEntries.push({ event, command: rewritten.commandRel });
    if (rewritten.scriptRel) {
      ctx.scripts.push(rewritten.scriptRel);
      ctx.deployedFiles.push({
        path: rewritten.scriptRel,
        primitive: {
          name: String(ctx.primitive.name),
          packageName: ctx.primitive.packageName,
        },
      });
    }
  }

  if (typeof next.type !== "string") next.type = "command";
  return next;
}

function normalizeAgyHookEvent(event: string): string {
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
  pkg: string;
  hookFile: string;
  command: string;
}): { commandRel: string; scriptRel?: string } {
  const { cwd, roots, pkg, hookFile, command } = args;
  // Strip leading interpreter tokens to find a relative script path.
  const tokens = command.split(/\s+/).filter(Boolean);
  let scriptToken = tokens.find((t) => t.includes("/") || /\.(py|sh|js|mjs|cjs|ts)$/i.test(t));
  if (!scriptToken && tokens.length === 1) scriptToken = tokens[0];
  if (!scriptToken) return { commandRel: command };

  const cleaned = scriptToken.replace(/^\.\//, "").replace(/^\$\{PLUGIN_ROOT\}\/?/, "");
  const packageRoot = findPackageRoot(hookFile);
  const hookDir = dirname(hookFile);
  const candidates = [
    resolve(hookDir, cleaned),
    resolve(hookDir, basename(cleaned)),
    resolve(packageRoot, cleaned),
    resolve(packageRoot, basename(cleaned)),
    resolve(packageRoot, "hooks", basename(cleaned)),
    resolve(dirname(packageRoot), cleaned),
    resolve(dirname(packageRoot), basename(cleaned)),
  ];
  const source = candidates.find((p) => {
    try {
      return existsSync(p) && statSync(p).isFile();
    } catch {
      return false;
    }
  });
  if (!source) return { commandRel: command };

  const destRel = `.agents/hooks/${pkg}/hooks/${basename(source)}`;
  const destAbs = join(cwd, destRel);
  assertUnderDeployRoots(cwd, destAbs, roots);
  mkdirSync(dirname(destAbs), { recursive: true });
  cpSync(source, destAbs);

  const rewrittenCmd = tokens
    .map((t) => (t === scriptToken || t.replace(/^\.\//, "") === cleaned ? destRel : t))
    .join(" ");
  return { commandRel: rewrittenCmd, scriptRel: destRel };
}

function readAgyHooksDoc(path: string): AgyHooksDoc {
  if (!existsSync(path)) return {};
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return raw && typeof raw === "object" && !Array.isArray(raw) ? { ...(raw as AgyHooksDoc) } : {};
  } catch {
    return {};
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

function cleanupOwnedScripts(cwd: string, ownership: OwnershipSidecar): void {
  for (const record of Object.values(ownership.owned ?? {})) {
    for (const scriptRel of record.scripts ?? []) {
      const abs = join(cwd, scriptRel);
      try {
        if (existsSync(abs) && statSync(abs).isFile()) rmSync(abs);
      } catch {
        // best-effort cleanup
      }
    }
  }
}
