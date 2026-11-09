import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type {
  AttributedPrimitive,
  BapmIntegration,
  CompileReport,
  ConfigureMcpContext,
  ConfigureMcpReport,
  ConfigureLspContext,
  ConfigureLspReport,
  HookOwnershipSidecar,
  LspServerConfig,
  MaterializeReport,
  McpServerConfig,
} from "@b-apm/integration-api";
import {
  assertUnderDeployRoots,
  compilePrimitivesMarkdown,
  copyHookScript,
  createMaterializeRun,
  materializeSkill,
  mergeLspServers,
  mergeMcpServers,
  normalizeHookEventName,
  normalizeNamedEntries,
  primitivePackageKey,
  primitivesMaterialize,
  readHookOwnershipSidecar,
  readHookSource,
  readJsonDocument,
  readPrimitiveContent,
  removeOwnedHookArtifacts,
  resolveEnvHome,
  sanitizeName,
  translateEnvMap,
  writeDeployedFile,
  writeHookOwnershipSidecar,
  writeJsonDocument,
} from "@b-apm/integration-api";

const DEFAULT_DEPLOY_ROOTS = [".github", ".agents"] as const;
const HOOKS_OWNERSHIP_REL = ".github/bapm-hooks.json";
const COMPILE_DEFAULT = ".github/copilot-instructions.md";
const LSP_JSON_REL = ".github/lsp.json";

const DETECT_DIRS = [
  ".github/instructions",
  ".github/agents",
  ".github/prompts",
  ".github/hooks",
] as const;

type HookEntry = { command?: string; type?: string; [key: string]: unknown };
type HookDoc = {
  hooks?: Record<string, HookEntry[]>;
  [key: string]: unknown;
};

/**
 * Create the GitHub Copilot runtime target.
 * Detect: APM SIGNAL_WHITELIST under `.github/` (any one signal; no mkdir).
 * Materialize: instructions/prompts/agents/hooks under `.github/`, skills under `.agents/skills/`.
 * MCP: home `~/.copilot/mcp-config.json` (`COPILOT_HOME`) with translate placeholders.
 * Compile: thin `.github/copilot-instructions.md`, omitting instruction primitives.
 */
export function createCopilotIntegration(options?: {
  id?: string;
  deployRoots?: string[];
}): BapmIntegration {
  const id = options?.id ?? "copilot";
  const deployRoots = [...(options?.deployRoots ?? DEFAULT_DEPLOY_ROOTS)];

  return {
    id,
    deployRoots,
    mcpEnvMode: "translate",
    mcpScope: "home",
    detect: ({ cwd }) => detectCopilot(cwd),
    getDeployRoots: () => [...deployRoots],
    async compile(primitives, context): Promise<CompileReport> {
      return compilePrimitivesMarkdown(primitives, context, {
        title: "# GitHub Copilot instructions",
        defaultOutput: COMPILE_DEFAULT,
        instructions: "omit",
        outsideCwdMessage: "Copilot compile output must be a cwd-relative file path",
      });
    },
    async materialize(primitives, ctx): Promise<MaterializeReport> {
      const run = createMaterializeRun({
        primitives,
        ctx,
        defaultDeployRoots: deployRoots,
        targetId: id,
      });
      const { cwd, roots, deployedFiles, diagnostics } = run;
      const skipPackages = new Set(
        Array.isArray(ctx?.skipNativeRegisteredPackages)
          ? (ctx.skipNativeRegisteredPackages as unknown[]).map(String)
          : [],
      );

      const hookPrimitives: AttributedPrimitive[] = [];

      await primitivesMaterialize(primitives, {
        skill(p, { name }) {
          if (skipPackages.has(String(p.packageName ?? ""))) return;
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
              destRel: join(".github", "instructions", `${name}.instructions.md`),
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
              destRel: join(".github", "agents", `${name}.agent.md`),
              content: readPrimitiveContent(p),
              primitive: { name: String(p.name), packageName: p.packageName },
            }),
          );
        },
        command(p, { name }) {
          materializePromptLike(p, name, cwd, roots, deployedFiles);
        },
        hook(p) {
          hookPrimitives.push(p);
        },
        unknown(p, { name, type }) {
          if (/prompt/.test(type)) {
            materializePromptLike(p, name, cwd, roots, deployedFiles);
          }
        },
      });

      if (hookPrimitives.length > 0) {
        const hookDeployed = materializeCopilotHooks({
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
      return writeCopilotMcpConfig(servers, {
        cwd: resolve(ctx?.cwd ?? process.cwd()),
        deployRoots: ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots,
        targetId: ctx?.targetId ?? id,
        managedServers: ctx?.managedServers,
      });
    },
    async configureLsp(servers, ctx): Promise<ConfigureLspReport> {
      return writeCopilotLspConfig(servers, {
        cwd: resolve(ctx?.cwd ?? process.cwd()),
        targetId: ctx?.targetId ?? id,
        managedServers: ctx?.managedServers,
      });
    },
  };
}

function detectCopilot(cwd: string): boolean {
  const instructions = join(cwd, ".github", "copilot-instructions.md");
  if (existsSync(instructions) && statSync(instructions).isFile()) return true;
  for (const rel of DETECT_DIRS) {
    const abs = join(cwd, rel);
    if (existsSync(abs) && statSync(abs).isDirectory()) return true;
  }
  return false;
}

function materializePromptLike(
  p: AttributedPrimitive,
  name: string,
  cwd: string,
  roots: string[],
  deployedFiles: MaterializeReport["deployedFiles"],
): void {
  deployedFiles.push(
    writeDeployedFile({
      cwd,
      deployRoots: roots,
      destRel: join(".github", "prompts", `${name}.prompt.md`),
      content: readPrimitiveContent(p),
      primitive: { name: String(p.name), packageName: p.packageName },
    }),
  );
}

function resolveCopilotHome(): string {
  return resolveEnvHome("COPILOT_HOME", [".copilot"]);
}

function writeCopilotMcpConfig(
  servers: McpServerConfig[] | Record<string, McpServerConfig>,
  ctx: ConfigureMcpContext & { cwd: string; deployRoots: string[] },
): ConfigureMcpReport {
  const home = resolveCopilotHome();
  mkdirSync(home, { recursive: true });
  const destFile = join(home, "mcp-config.json");

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
    configPath: destFile,
    servers: merged.servers,
    deployedFiles: [],
    diagnostics,
  };
}

/** Merge/write Copilot CLI's project `.github/lsp.json` config. */
function writeCopilotLspConfig(
  servers: LspServerConfig[] | Record<string, LspServerConfig>,
  ctx: ConfigureLspContext & { cwd: string },
): ConfigureLspReport {
  const destFile = join(ctx.cwd, LSP_JSON_REL);
  const rawExisting = existsSync(destFile) ? readFileSync(destFile, "utf8") : undefined;
  const existing = parseCopilotLspJson(rawExisting, LSP_JSON_REL);
  const incoming = normalizeCopilotLspEntries(servers);
  const merged = mergeLspServers({
    document: existing ?? {},
    key: "lspServers",
    incoming,
    managedServers: ctx.managedServers,
    ownershipLabel: "COPILOT_LSP_OWNERSHIP",
    pathLabel: LSP_JSON_REL,
  });
  const doc = merged.document;
  const content = `${JSON.stringify(doc, null, 2)}\n`;
  const writtenNames = merged.servers;

  if (rawExisting === undefined && writtenNames.length === 0) {
    return {
      targetId: ctx.targetId,
      configPath: LSP_JSON_REL,
      servers: [],
      deployedFiles: [],
    };
  }

  mkdirSync(dirname(destFile), { recursive: true });
  if (rawExisting !== content) writeFileSync(destFile, content, "utf8");

  return {
    targetId: ctx.targetId,
    configPath: LSP_JSON_REL,
    servers: writtenNames,
    deployedFiles: [{ path: LSP_JSON_REL }],
  };
}

function parseCopilotLspJson(
  raw: string | undefined,
  label: string,
): Record<string, unknown> | undefined {
  if (raw === undefined) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`COPILOT_LSP_INVALID: ${label} must contain a JSON object`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`COPILOT_LSP_INVALID: ${label} must contain a JSON object`);
  }
  return { ...(parsed as Record<string, unknown>) };
}

function normalizeCopilotLspEntries(
  servers: LspServerConfig[] | Record<string, LspServerConfig>,
): Record<string, Record<string, unknown>> {
  const list: LspServerConfig[] = Array.isArray(servers)
    ? servers
    : Object.entries(servers).map(([name, value]) => ({ ...value, name: value.name ?? name }));
  const out: Record<string, Record<string, unknown>> = {};
  for (const server of list) {
    const name = String(server.name ?? "").trim();
    if (!name) throw new Error("COPILOT_LSP_INVALID: LSP server name must be non-empty");
    const command = typeof server.command === "string" ? server.command.trim() : "";
    if (!command) {
      throw new Error(`COPILOT_LSP_INVALID: LSP server "${name}" requires a stdio command`);
    }
    if (typeof server.url === "string" && server.url.trim()) {
      throw new Error(
        `COPILOT_LSP_UNSUPPORTED: LSP server "${name}" uses url; only stdio command servers are supported`,
      );
    }
    const language =
      server.extensionToLanguage ?? server.fileExtensions ?? server.extension_to_language;
    if (!language || typeof language !== "object" || Array.isArray(language)) {
      throw new Error(`COPILOT_LSP_INVALID: LSP server "${name}" requires fileExtensions`);
    }
    const entry: Record<string, unknown> = {
      command,
      args: Array.isArray(server.args) ? [...server.args] : [],
      fileExtensions: { ...language },
    };
    if (server.env && typeof server.env === "object" && !Array.isArray(server.env)) {
      entry.env = { ...(server.env as Record<string, string>) };
    }
    if (server.initializationOptions !== undefined) {
      entry.initializationOptions = server.initializationOptions;
    }
    if (server.workspaceFolder !== undefined) entry.rootUri = server.workspaceFolder;
    const timeout = server.startupTimeout ?? server.warmupTimeoutMs;
    if (timeout !== undefined) entry.warmupTimeoutMs = timeout;
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
    out[server.name] = toCopilotServerEntry(server);
  }
  return { entries: out, diagnostics };
}

function toCopilotServerEntry(server: McpServerConfig): Record<string, unknown> {
  const transport = String(server.transport ?? server.type ?? "").toLowerCase();
  const entry: Record<string, unknown> = {};

  if (transport === "http" || transport === "sse" || typeof server.url === "string") {
    if (server.url) entry.url = server.url;
    if (transport) entry.type = transport === "sse" ? "sse" : "http";
  } else {
    if (server.command) entry.command = String(server.command);
    if (Array.isArray(server.args)) entry.args = server.args;
    entry.type = "stdio";
  }

  if (server.env && typeof server.env === "object") {
    entry.env = translateEnvMap(server.env, "dollar-bare");
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

/** Normalize hook event names to camelCase (`session_start` / `SessionStart` → `sessionStart`). */
export function toCamelCaseEvent(event: string): string {
  return normalizeHookEventName(event, "camel");
}

function packageKey(p: AttributedPrimitive): string {
  return primitivePackageKey(p);
}

function materializeCopilotHooks(args: {
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
  mkdirSync(join(cwd, ".github", "hooks"), { recursive: true });

  const ownership = readHookOwnershipSidecar(ownershipPath);
  removeOwnedHookArtifacts(cwd, ownership);

  const nextOwned: HookOwnershipSidecar["owned"] = {};

  for (const p of hooks) {
    const stem = sanitizeName(String(p.name));
    const pkg = packageKey(p);
    const hookRel = `.github/hooks/${pkg}-${stem}.json`;
    const hookAbs = join(cwd, hookRel);
    assertUnderDeployRoots(cwd, hookAbs, roots);

    const source = readHookSource(p, {
      missingCode: "COPILOT_HOOK_SOURCE_MISSING",
      invalidCode: "COPILOT_HOOK_JSON_INVALID",
    });
    if (source.diagnostics.length > 0) {
      diagnostics.push(...source.diagnostics);
      continue;
    }
    const srcPath = resolve(p.path!);
    const sourceHooks = source.hooks;
    const outHooks: Record<string, HookEntry[]> = {};
    const scripts: string[] = [];

    for (const [event, entries] of Object.entries(sourceHooks)) {
      if (!Array.isArray(entries)) continue;
      const camel = normalizeHookEventName(event, "camel");
      const destList: HookEntry[] = [];
      for (const entry of entries as HookEntry[]) {
        if (!entry || typeof entry !== "object") continue;
        const command = typeof entry.command === "string" ? entry.command.trim() : "";
        const { _apm_source: _drop, ...clean } = entry as HookEntry & { _apm_source?: unknown };
        void _drop;
        if (!command) {
          destList.push({ ...clean });
          continue;
        }
        const rewritten = copyHookScript({
          cwd,
          deployRoots: roots,
          hookFile: srcPath,
          command,
          alreadyDeployedNeedle: ".github/hooks/",
          destRel: `.github/hooks/scripts/${pkg}/${basename(command.replace(/^\.\//, ""))}`,
          commandAsDotSlash: true,
        });
        destList.push({ ...clean, command: rewritten.commandRel });
        if (rewritten.scriptRel) {
          scripts.push(rewritten.scriptRel);
          deployedFiles.push({
            path: rewritten.scriptRel,
            primitive: { name: String(p.name), packageName: p.packageName },
          });
        }
      }
      outHooks[camel] = destList;
    }

    const doc: HookDoc = { hooks: outHooks };
    writeJsonDocument(hookAbs, doc);
    deployedFiles.push({
      path: hookRel,
      primitive: { name: String(p.name), packageName: p.packageName },
    });

    const ownedKey = `${pkg}-${stem}`;
    nextOwned[ownedKey] = {
      ...(p.packageName ? { packageName: p.packageName } : {}),
      hookFile: hookRel,
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
