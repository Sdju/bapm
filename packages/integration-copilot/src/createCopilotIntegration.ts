import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
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
type OwnershipSidecar = {
  owned: Record<
    string,
    {
      packageName?: string;
      hookFile: string;
      scripts: string[];
    }
  >;
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
      return compileCopilotInstructions(primitivesList(primitives), context);
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
          const destFile = join(cwd, ".github", "instructions", `${name}.instructions.md`);
          assertUnderDeployRoots(cwd, destFile, roots);
          mkdirSync(dirname(destFile), { recursive: true });
          writeFileSync(destFile, readPrimitiveContent(p), "utf8");
          deployedFiles.push({
            path: toPosixRel(cwd, destFile),
            primitive: { name: String(p.name), packageName: p.packageName },
          });
        },
        agent(p, { name }) {
          const destFile = join(cwd, ".github", "agents", `${name}.agent.md`);
          assertUnderDeployRoots(cwd, destFile, roots);
          mkdirSync(dirname(destFile), { recursive: true });
          writeFileSync(destFile, readPrimitiveContent(p), "utf8");
          deployedFiles.push({
            path: toPosixRel(cwd, destFile),
            primitive: { name: String(p.name), packageName: p.packageName },
          });
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
  const destFile = join(cwd, ".github", "prompts", `${name}.prompt.md`);
  assertUnderDeployRoots(cwd, destFile, roots);
  mkdirSync(dirname(destFile), { recursive: true });
  writeFileSync(destFile, readPrimitiveContent(p), "utf8");
  deployedFiles.push({
    path: toPosixRel(cwd, destFile),
    primitive: { name: String(p.name), packageName: p.packageName },
  });
}

function compileCopilotInstructions(
  primitives: AttributedPrimitive[],
  context: CompileContext,
): CompileReport {
  const cwd = resolve(context.cwd);
  const outputFile = context.outputFile ?? COMPILE_DEFAULT;
  const outputPath = resolve(cwd, outputFile);
  const rel = toPosixRel(cwd, outputPath);
  if (!rel || rel.startsWith("..")) {
    throw new Error("Copilot compile output must be a cwd-relative file path");
  }

  const content = renderCopilotInstructions(primitives);
  const wrote = context.write;
  if (wrote) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, content, "utf8");
  }

  return { path: rel, content, wrote };
}

function renderCopilotInstructions(primitives: AttributedPrimitive[]): string {
  // Instructions already land under `.github/instructions/` — omit from thin compile.
  const filtered = primitives.filter((p) => !/instruction/i.test(String(p.type ?? "")));
  const sorted = [...filtered].sort((a, b) => {
    const type = String(a.type ?? "").localeCompare(String(b.type ?? ""));
    if (type !== 0) return type;
    const name = String(a.name ?? "").localeCompare(String(b.name ?? ""));
    return name !== 0 ? name : String(a.path ?? "").localeCompare(String(b.path ?? ""));
  });
  const sections = [
    "# GitHub Copilot instructions",
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

  const ownership = readOwnershipSidecar(ownershipPath);
  removeOwnedArtifacts(cwd, ownership);

  const nextOwned: OwnershipSidecar["owned"] = {};

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
          roots,
          pkg,
          hookFile: srcPath,
          command,
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

  writeFileSync(
    ownershipPath,
    `${JSON.stringify({ owned: nextOwned } satisfies OwnershipSidecar, null, 2)}\n`,
    "utf8",
  );
  deployedFiles.push({
    path: HOOKS_OWNERSHIP_REL,
    ...(hooks[0]
      ? { primitive: { name: String(hooks[0].name), packageName: hooks[0].packageName } }
      : {}),
  });

  return { deployedFiles, diagnostics };
}

function copyHookScript(args: {
  cwd: string;
  roots: string[];
  pkg: string;
  hookFile: string;
  command: string;
}): { commandRel: string; scriptRel?: string } {
  const { cwd, roots, pkg, hookFile, command } = args;
  if (command.includes(".github/hooks/")) {
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

  const destRel = `.github/hooks/scripts/${pkg}/${basename(source)}`;
  const destAbs = join(cwd, destRel);
  assertUnderDeployRoots(cwd, destAbs, roots);
  mkdirSync(dirname(destAbs), { recursive: true });
  cpSync(source, destAbs);
  return { commandRel: `./${destRel}`, scriptRel: destRel };
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

function removeOwnedArtifacts(cwd: string, ownership: OwnershipSidecar): void {
  for (const record of Object.values(ownership.owned ?? {})) {
    if (record.hookFile) {
      const abs = join(cwd, record.hookFile);
      if (existsSync(abs)) rmSync(abs, { force: true });
    }
    for (const script of record.scripts ?? []) {
      const abs = join(cwd, script);
      if (existsSync(abs)) rmSync(abs, { force: true });
    }
  }
}
