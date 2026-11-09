import { existsSync, mkdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { stringify as stringifyToml } from "smol-toml";
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
  materializeSkill,
  mergeHookDeployment,
  mergeMcpServers,
  normalizeNamedEntries,
  primitivesMaterialize,
  readJsonDocument,
  readPrimitiveContent,
  sanitizeName,
  writeDeployedFile,
  writeJsonDocument,
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
      return compilePrimitivesMarkdown(primitives, context, {
        title: "# GEMINI.md",
        defaultOutput: COMPILE_DEFAULT,
        instructions: "only",
        emptyMessage: "_No discoverable instruction primitives._",
        sectionHeading: (p) => String(p.name),
        requireBasename: "GEMINI.md",
        outsideCwdMessage: "Gemini compile output must be a cwd-relative file path",
      });
    },
    async materialize(primitives, ctx): Promise<MaterializeReport> {
      const run = createMaterializeRun({
        primitives,
        ctx,
        defaultDeployRoots: deployRoots,
        targetId: id,
        requiredRoots: [".gemini", ".agents"],
        label: "gemini",
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

      return run.report();
    },
    async configureMcp(servers, ctx): Promise<ConfigureMcpReport> {
      return writeGeminiMcpConfig(servers, {
        cwd: resolve(ctx?.cwd ?? process.cwd()),
        deployRoots: ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots,
        targetId: ctx?.targetId ?? id,
        managedServers: ctx?.managedServers,
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
            "Skipping project MCP write for gemini: .gemini/ directory is absent (Gemini project-scope MCP is opt-in; create .gemini/ and re-run install)",
          target: ctx.targetId,
          dir: ".gemini/",
          warn: true,
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

  const { entries: incoming, diagnostics } = normalizeServerEntries(servers);
  const merged = mergeMcpServers({
    document: existingDoc as Record<string, unknown>,
    key: "mcpServers",
    incoming,
    managedServers: ctx.managedServers,
    merge: "replace",
  });
  writeJsonDocument(destFile, merged.document);

  return {
    targetId: ctx.targetId,
    configPath: SETTINGS_JSON_REL,
    servers: merged.servers,
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

  for (const server of normalizeNamedEntries(servers)) {
    const entry = toGeminiServerEntry(server);
    if (!entry) {
      diagnostics.push({
        code: "GEMINI_MCP_UNSUPPORTED",
        message: `Gemini cannot faithfully represent MCP server "${server.name}"`,
        server: server.name,
      });
      continue;
    }
    out[server.name] = entry;
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
  const settingsPath = join(cwd, SETTINGS_JSON_REL);
  const ownershipPath = join(cwd, HOOKS_OWNERSHIP_REL);
  assertUnderDeployRoots(cwd, settingsPath, roots);
  assertUnderDeployRoots(cwd, ownershipPath, roots);
  mkdirSync(join(cwd, ".gemini"), { recursive: true });

  const result = mergeHookDeployment({
    cwd,
    deployRoots: roots,
    hooks,
    docPath: settingsPath,
    ownershipPath,
    docRel: SETTINGS_JSON_REL,
    ownershipRel: HOOKS_OWNERSHIP_REL,
    mode: "flat",
    code: "GEMINI",
    normalizeEvent: (event) => GEMINI_EVENT_REMAP[event] ?? event,
    alreadyDeployedNeedle: ".gemini/",
    commandAsDotSlash: true,
    propagateVersion: false,
    scriptDestRel: ({ name, command }) =>
      `.gemini/hooks/${name}/${basename(command.replace(/^\.\//, ""))}`,
  });

  return { deployedFiles: result.deployedFiles, diagnostics: result.diagnostics };
}

function readSettingsDoc(path: string): SettingsDoc {
  const doc = readJsonDocument({ path }) as SettingsDoc;
  if (!doc.hooks || typeof doc.hooks !== "object") doc.hooks = {};
  return doc;
}
