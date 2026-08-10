import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { stringify as stringifyToml } from "smol-toml";
import type {
  AttributedPrimitive,
  BapmIntegration,
  CompileReport,
  ConfigureMcpContext,
  ConfigureMcpReport,
  HookOwnershipSidecar,
  MaterializeReport,
  McpServerConfig,
} from "@b-apm/integration-api";
import {
  assertUnderDeployRoots,
  compileMarkdownReport,
  copyHookScript,
  materializeSkill,
  primitivesList,
  primitivesMaterialize,
  readHookOwnershipSidecar,
  readPrimitiveContent,
  renderPrimitivesMarkdown,
  sanitizeName,
  stripOwnedHookCommands,
  writeDeployedFile,
  writeHookOwnershipSidecar,
} from "@b-apm/integration-api";

const DEFAULT_DEPLOY_ROOTS = [".gemini", ".agents", "."] as const;
const SETTINGS_JSON_REL = ".gemini/settings.json";
const HOOKS_OWNERSHIP_REL = ".gemini/bapm-hooks.json";
const COMPILE_DEFAULT = "GEMINI.md";

const GEMINI_EVENT_REMAP: Record<string, string> = {
  PreToolUse: "BeforeTool",
  preToolUse: "BeforeTool",
  PostToolUse: "AfterTool",
  postToolUse: "AfterTool",
  Stop: "SessionEnd",
};

/**
 * Create the Gemini CLI target.
 * Detect: `.gemini/` directory **or** project-root `GEMINI.md`.
 * Materialize: skills → `.agents/skills/<name>/SKILL.md`,
 * commands → `.gemini/commands/<name>.toml`,
 * instructions → compile-only (diagnostic),
 * hooks → merge `.gemini/settings.json` (+ scripts / ownership sidecar).
 * MCP: `configureMcp` → `.gemini/settings.json` `mcpServers` when `.gemini/` exists.
 * Compile: project-root `GEMINI.md` with instruction primitives only.
 */
export function createGeminiIntegration(options?: {
  id?: string;
  deployRoots?: string[];
}): BapmIntegration {
  const id = options?.id ?? "gemini";
  const deployRoots = [...(options?.deployRoots ?? DEFAULT_DEPLOY_ROOTS)];

  return {
    id,
    deployRoots,
    detect: ({ cwd }) => detectGemini(cwd),
    getDeployRoots: () => [...deployRoots],
    async compile(primitives, context): Promise<CompileReport> {
      const content = renderPrimitivesMarkdown({
        primitives: primitivesList(primitives),
        title: "# GEMINI.md",
        filter: (p) => /instruction/i.test(String(p.type ?? "")),
        emptyMessage: "_No discoverable instruction primitives._",
        sectionHeading: (p) => String(p.name),
      });
      return compileMarkdownReport({
        cwd: context.cwd,
        outputFile: context.outputFile ?? COMPILE_DEFAULT,
        write: context.write,
        content,
        requireBasename: "GEMINI.md",
        outsideCwdMessage: "Gemini compile output must be a cwd-relative file path",
      });
    },
    async materialize(primitives, ctx): Promise<MaterializeReport> {
      const cwd = resolve(ctx?.cwd ?? process.cwd());
      const roots = ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots;
      if (!roots.some((r) => r === ".gemini" || r.startsWith(".gemini"))) {
        throw new Error("gemini target missing .gemini deploy root");
      }
      if (!roots.some((r) => r === ".agents" || r.startsWith(".agents"))) {
        throw new Error("gemini target missing .agents deploy root");
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
            code: "GEMINI_INSTRUCTION_COMPILE_ONLY",
            message: `Gemini does not materialize instruction primitives as host files (compile-only): "${p.name}"`,
            primitive: String(p.name),
            kind: "instruction",
          });
        },
        agent(p) {
          diagnostics.push({
            code: "GEMINI_PRIMITIVE_UNSUPPORTED",
            message: `Gemini does not materialize agent primitives as host files: "${p.name}"`,
            primitive: String(p.name),
            kind: "agent",
          });
        },
        command(p, { name }) {
          const result = materializeGeminiCommand({ cwd, roots, primitive: p, name });
          deployedFiles.push(...result.deployedFiles);
          diagnostics.push(...result.diagnostics);
        },
        hook(p) {
          hookPrimitives.push(p);
        },
        unknown(p, { type }) {
          if (/prompt/i.test(type)) {
            const name = sanitizeName(String(p.name));
            const result = materializeGeminiCommand({ cwd, roots, primitive: p, name });
            deployedFiles.push(...result.deployedFiles);
            diagnostics.push(...result.diagnostics);
          }
        },
      });

      if (hookPrimitives.length > 0) {
        const hookDeployed = materializeGeminiHooks({
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
      return writeGeminiMcpConfig(servers, {
        cwd: resolve(ctx?.cwd ?? process.cwd()),
        deployRoots: ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots,
        targetId: ctx?.targetId ?? id,
      });
    },
  };
}

function detectGemini(cwd: string): boolean {
  const geminiDir = join(cwd, ".gemini");
  if (existsSync(geminiDir) && statSync(geminiDir).isDirectory()) return true;
  const geminiMd = join(cwd, "GEMINI.md");
  return existsSync(geminiMd) && statSync(geminiMd).isFile();
}

function materializeGeminiCommand(args: {
  cwd: string;
  roots: string[];
  primitive: AttributedPrimitive;
  name: string;
}): {
  deployedFiles: MaterializeReport["deployedFiles"];
  diagnostics: NonNullable<MaterializeReport["diagnostics"]>;
} {
  const { cwd, roots, primitive, name } = args;
  const diagnostics: NonNullable<MaterializeReport["diagnostics"]> = [];
  const source = readPrimitiveContent(primitive);
  const { description, prompt } = transformGeminiCommand(source);

  // Keep description before prompt when both present (stable for tests / humans).
  const ordered: Record<string, string> = description ? { description, prompt } : { prompt };

  return {
    deployedFiles: [
      writeDeployedFile({
        cwd,
        deployRoots: roots,
        destRel: join(".gemini", "commands", `${name}.toml`),
        content: stringifyToml(ordered),
        primitive: { name: String(primitive.name), packageName: primitive.packageName },
      }),
    ],
    diagnostics,
  };
}

function transformGeminiCommand(source: string): { description: string; prompt: string } {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  let description = "";
  let body = source;
  if (match) {
    const rawFm = match[1] ?? "";
    body = match[2] ?? "";
    for (const line of rawFm.split(/\r?\n/)) {
      const keyMatch = line.match(/^description\s*:\s*(.*)$/i);
      if (!keyMatch) continue;
      description = keyMatch[1]!.trim().replace(/^["']|["']$/g, "");
      break;
    }
  }

  let prompt = body.trim();
  prompt = prompt.replaceAll("$ARGUMENTS", "{{args}}");
  if (/(?<!\d)\$\d+/.test(prompt)) {
    prompt = `Arguments: {{args}}\n\n${prompt}`;
  }
  return { description, prompt };
}

function writeGeminiMcpConfig(
  servers: McpServerConfig[] | Record<string, McpServerConfig>,
  ctx: ConfigureMcpContext & { cwd: string; deployRoots: string[] },
): ConfigureMcpReport {
  const { cwd, deployRoots } = ctx;
  const geminiDir = join(cwd, ".gemini");
  if (!existsSync(geminiDir) || !statSync(geminiDir).isDirectory()) {
    return {
      targetId: ctx.targetId,
      configPath: SETTINGS_JSON_REL,
      servers: [],
      deployedFiles: [],
      diagnostics: [
        {
          code: "GEMINI_MCP_SKIP_NO_GEMINI_DIR",
          message:
            "Skipping project MCP write: .gemini/ directory is absent (Gemini project-scope MCP is opt-in)",
        },
      ],
    };
  }

  if (!deployRoots.some((r) => r === ".gemini" || r.startsWith(".gemini"))) {
    throw new Error("gemini configureMcp requires a registered '.gemini' deploy root");
  }

  const destFile = join(cwd, SETTINGS_JSON_REL);
  assertUnderDeployRoots(cwd, destFile, deployRoots);

  const existingDoc = readSettingsDoc(destFile);
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

  const doc: SettingsDoc = { ...existingDoc, mcpServers: nextServers };
  writeFileSync(destFile, `${JSON.stringify(doc, null, 2)}\n`, "utf8");

  return {
    targetId: ctx.targetId,
    configPath: SETTINGS_JSON_REL,
    servers: writtenNames,
    deployedFiles: [{ path: SETTINGS_JSON_REL }],
    diagnostics,
  };
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
    const entry = toGeminiServerEntry(server);
    if (!entry) {
      diagnostics.push({
        code: "GEMINI_MCP_UNSUPPORTED",
        message: `Gemini cannot faithfully represent MCP server "${name}"`,
        server: name,
      });
      continue;
    }
    out[name] = entry;
  }
  return { entries: out, diagnostics };
}

function toGeminiServerEntry(server: McpServerConfig): Record<string, unknown> | undefined {
  const transport = String(server.transport ?? server.type ?? "").toLowerCase();
  const entry: Record<string, unknown> = {};

  if (transport === "sse" || (typeof server.url === "string" && transport === "sse")) {
    if (typeof server.url !== "string") return undefined;
    entry.url = server.url;
  } else if (
    transport === "http" ||
    transport === "streamable-http" ||
    (typeof server.url === "string" && transport !== "stdio")
  ) {
    if (typeof server.url !== "string") return undefined;
    entry.httpUrl = server.url;
  } else if (transport === "stdio" || server.command) {
    if (typeof server.command !== "string") return undefined;
    entry.command = server.command;
    if (Array.isArray(server.args)) entry.args = server.args;
  } else {
    return undefined;
  }

  if (server.env && typeof server.env === "object") entry.env = server.env;
  if (server.headers && typeof server.headers === "object") entry.headers = server.headers;

  return entry;
}

type HookEntry = { command?: string; [key: string]: unknown };
type SettingsDoc = {
  hooks?: Record<string, HookEntry[]>;
  mcpServers?: Record<string, unknown>;
  [key: string]: unknown;
};

function materializeGeminiHooks(args: {
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

  const settingsPath = join(cwd, SETTINGS_JSON_REL);
  const ownershipPath = join(cwd, HOOKS_OWNERSHIP_REL);
  assertUnderDeployRoots(cwd, settingsPath, roots);
  assertUnderDeployRoots(cwd, ownershipPath, roots);
  mkdirSync(join(cwd, ".gemini"), { recursive: true });

  const doc = readSettingsDoc(settingsPath);
  const ownership = readHookOwnershipSidecar(ownershipPath);

  if (doc.hooks && typeof doc.hooks === "object") {
    stripOwnedHookCommands(doc.hooks as Record<string, unknown>, ownership);
  }

  const nextOwned: HookOwnershipSidecar["owned"] = {};

  for (const p of hooks) {
    const name = sanitizeName(String(p.name));
    const srcPath = p.path ? resolve(p.path) : undefined;
    if (!srcPath || !existsSync(srcPath) || !statSync(srcPath).isFile()) {
      diagnostics.push({
        code: "GEMINI_HOOK_SOURCE_MISSING",
        message: `Hook primitive "${p.name}" has no readable source JSON`,
        primitive: String(p.name),
      });
      continue;
    }

    let parsed: SettingsDoc;
    try {
      parsed = JSON.parse(readFileSync(srcPath, "utf8")) as SettingsDoc;
    } catch (cause) {
      diagnostics.push({
        code: "GEMINI_HOOK_JSON_INVALID",
        message: `Hook "${p.name}" JSON is invalid: ${cause instanceof Error ? cause.message : String(cause)}`,
        primitive: String(p.name),
      });
      continue;
    }

    const sourceHooks = parsed.hooks && typeof parsed.hooks === "object" ? parsed.hooks : {};
    const ownedEntries: Array<{ event: string; command: string }> = [];
    const scripts: string[] = [];

    if (!doc.hooks || typeof doc.hooks !== "object") doc.hooks = {};

    for (const [rawEvent, entries] of Object.entries(sourceHooks)) {
      if (!Array.isArray(entries)) continue;
      const event = GEMINI_EVENT_REMAP[rawEvent] ?? rawEvent;
      const destList = Array.isArray(doc.hooks[event]) ? [...doc.hooks[event]!] : [];
      for (const entry of entries) {
        if (!entry || typeof entry !== "object") continue;
        const command = typeof entry.command === "string" ? entry.command.trim() : "";
        if (!command) {
          const { _apm_source: _drop, ...clean } = entry as HookEntry & { _apm_source?: unknown };
          void _drop;
          destList.push({ ...clean });
          continue;
        }

        const rewritten = copyHookScript({
          cwd,
          deployRoots: roots,
          hookFile: srcPath,
          command,
          alreadyDeployedNeedle: ".gemini/",
          destRel: `.gemini/hooks/${name}/${basename(command.replace(/^\.\//, ""))}`,
          commandAsDotSlash: true,
        });
        const { _apm_source: _drop, ...clean } = entry as HookEntry & { _apm_source?: unknown };
        void _drop;
        const nextEntry: HookEntry = { ...clean, command: rewritten.commandRel };
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

  writeFileSync(settingsPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  writeHookOwnershipSidecar(ownershipPath, { owned: nextOwned });

  deployedFiles.push({
    path: SETTINGS_JSON_REL,
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

function readSettingsDoc(path: string): SettingsDoc {
  if (!existsSync(path)) return { hooks: {} };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as SettingsDoc;
    if (!raw || typeof raw !== "object") return { hooks: {} };
    return raw;
  } catch {
    return { hooks: {} };
  }
}
