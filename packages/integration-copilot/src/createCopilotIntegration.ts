import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import type {
  AttributedPrimitive,
  BapmIntegration,
  CompileReport,
  ConfigureMcpContext,
  ConfigureMcpReport,
  HookOwnershipSidecar,
  MaterializeReport,
  McpServerConfig,
} from "@bapm/integration-api";
import {
  assertUnderDeployRoots,
  compileMarkdownReport,
  copyHookScript,
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
} from "@bapm/integration-api";

const DEFAULT_DEPLOY_ROOTS = [".github", ".agents"] as const;
const HOOKS_OWNERSHIP_REL = ".github/bapm-hooks.json";
const COMPILE_DEFAULT = ".github/copilot-instructions.md";

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
    detect: ({ cwd }) => detectCopilot(cwd),
    getDeployRoots: () => [...deployRoots],
    async compile(primitives, context): Promise<CompileReport> {
      const content = renderPrimitivesMarkdown({
        primitives: primitivesList(primitives),
        title: "# GitHub Copilot instructions",
        filter: (p) => !/instruction/i.test(String(p.type ?? "")),
      });
      return compileMarkdownReport({
        cwd: context.cwd,
        outputFile: context.outputFile ?? COMPILE_DEFAULT,
        write: context.write,
        content,
        outsideCwdMessage: "Copilot compile output must be a cwd-relative file path",
      });
    },
    async materialize(primitives, ctx): Promise<MaterializeReport> {
      const cwd = resolve(ctx?.cwd ?? process.cwd());
      const roots = ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots;

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

      return {
        targetId: id,
        deployedFiles,
        ...(diagnostics.length > 0 ? { diagnostics } : {}),
      };
    },
    async configureMcp(servers, ctx): Promise<ConfigureMcpReport> {
      return writeCopilotMcpConfig(servers, {
        cwd: resolve(ctx?.cwd ?? process.cwd()),
        deployRoots: ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots,
        targetId: ctx?.targetId ?? id,
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
  const override = process.env.COPILOT_HOME?.trim();
  if (override) return resolve(override);
  return join(homedir(), ".copilot");
}

function writeCopilotMcpConfig(
  servers: McpServerConfig[] | Record<string, McpServerConfig>,
  ctx: ConfigureMcpContext & { cwd: string; deployRoots: string[] },
): ConfigureMcpReport {
  const home = resolveCopilotHome();
  mkdirSync(home, { recursive: true });
  const destFile = join(home, "mcp-config.json");

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
    configPath: destFile,
    servers: writtenNames,
    deployedFiles: [],
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
    out[name] = toCopilotServerEntry(server);
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

/** Normalize hook event names to camelCase (`session_start` / `SessionStart` → `sessionStart`). */
export function toCamelCaseEvent(event: string): string {
  const trimmed = String(event ?? "").trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes("_") || trimmed.includes("-")) {
    const parts = trimmed.split(/[_-]+/).filter(Boolean);
    return parts
      .map((part, index) => {
        const lower = part.toLowerCase();
        if (index === 0) return lower;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join("");
  }
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
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

    const srcPath = p.path ? resolve(p.path) : undefined;
    if (!srcPath || !existsSync(srcPath) || !statSync(srcPath).isFile()) {
      diagnostics.push({
        code: "COPILOT_HOOK_SOURCE_MISSING",
        message: `Hook primitive "${p.name}" has no readable source JSON`,
        primitive: String(p.name),
      });
      continue;
    }

    let parsed: HookDoc;
    try {
      parsed = JSON.parse(readFileSync(srcPath, "utf8")) as HookDoc;
    } catch (cause) {
      diagnostics.push({
        code: "COPILOT_HOOK_JSON_INVALID",
        message: `Hook "${p.name}" JSON is invalid: ${cause instanceof Error ? cause.message : String(cause)}`,
        primitive: String(p.name),
      });
      continue;
    }

    const sourceHooks = parsed.hooks && typeof parsed.hooks === "object" ? parsed.hooks : {};
    const outHooks: Record<string, HookEntry[]> = {};
    const scripts: string[] = [];

    for (const [event, entries] of Object.entries(sourceHooks)) {
      if (!Array.isArray(entries)) continue;
      const camel = toCamelCaseEvent(event);
      const destList: HookEntry[] = [];
      for (const entry of entries) {
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
    writeFileSync(hookAbs, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
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
