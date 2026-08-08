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
  ConfigureMcpContext,
  ConfigureMcpReport,
  MaterializeReport,
  McpServerConfig,
} from "@bapm/integration-api";
import {
  assertUnderDeployRoots,
  findPackageRoot,
  materializeSkill,
  primitivesMaterialize,
  readPrimitiveContent,
  sanitizeName,
  toPosixRel,
} from "@bapm/integration-api";

const DEFAULT_DEPLOY_ROOTS = [".windsurf", ".agents"] as const;
const HOOKS_JSON_REL = ".windsurf/hooks.json";
const HOOKS_OWNERSHIP_REL = ".windsurf/bapm-hooks.json";

type HookEntry = { command?: string; type?: string; [key: string]: unknown };
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

/**
 * Create the Windsurf/Cascade runtime target.
 * Detect: `.windsurf/` directory (no mkdir).
 * Materialize: instructions → `.windsurf/rules/`, commands → `.windsurf/workflows/`,
 * skills → `.agents/skills/`, hooks → merge `.windsurf/hooks.json` (+ sidecar),
 * agents → skip (diagnostic).
 * MCP: home `~/.codeium/windsurf/mcp_config.json` (`CODEIUM_HOME`) bake-mode parity.
 */
export function createWindsurfIntegration(options?: {
  id?: string;
  deployRoots?: string[];
}): BapmIntegration {
  const id = options?.id ?? "windsurf";
  const deployRoots = [...(options?.deployRoots ?? DEFAULT_DEPLOY_ROOTS)];

  return {
    id,
    deployRoots,
    detect: ({ cwd }) => {
      const dir = join(cwd, ".windsurf");
      return existsSync(dir) && statSync(dir).isDirectory();
    },
    getDeployRoots: () => [...deployRoots],
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
          const destFile = join(cwd, ".windsurf", "rules", `${name}.md`);
          assertUnderDeployRoots(cwd, destFile, roots);
          mkdirSync(dirname(destFile), { recursive: true });
          writeFileSync(destFile, readPrimitiveContent(p), "utf8");
          deployedFiles.push({
            path: toPosixRel(cwd, destFile),
            primitive: { name: String(p.name), packageName: p.packageName },
          });
        },
        command(p, { name }) {
          const destFile = join(cwd, ".windsurf", "workflows", `${name}.md`);
          assertUnderDeployRoots(cwd, destFile, roots);
          mkdirSync(dirname(destFile), { recursive: true });
          writeFileSync(destFile, readPrimitiveContent(p), "utf8");
          deployedFiles.push({
            path: toPosixRel(cwd, destFile),
            primitive: { name: String(p.name), packageName: p.packageName },
          });
        },
        agent(p) {
          diagnostics.push({
            code: "WINDSURF_AGENTS_UNSUPPORTED",
            message: `Windsurf does not materialize agents; ship "${p.name}" as a skill under .apm/skills/ instead`,
            primitive: String(p.name),
          });
        },
        hook(p) {
          hookPrimitives.push(p);
        },
      });

      if (hookPrimitives.length > 0) {
        const hookDeployed = materializeWindsurfHooks({
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
      return writeWindsurfMcpConfig(servers, {
        cwd: resolve(ctx?.cwd ?? process.cwd()),
        deployRoots: ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots,
        targetId: ctx?.targetId ?? id,
      });
    },
  };
}

export const createIntegration = createWindsurfIntegration;

/** Normalize hook event names to PascalCase (`session_start` / `sessionStart` → `SessionStart`). */
export function toPascalCaseEvent(event: string): string {
  const trimmed = String(event ?? "").trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes("_") || trimmed.includes("-")) {
    return trimmed
      .split(/[_-]+/)
      .filter(Boolean)
      .map((part) => {
        const lower = part.toLowerCase();
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join("");
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function resolveWindsurfHome(): string {
  const override = process.env.CODEIUM_HOME?.trim();
  if (override) return join(resolve(override), "windsurf");
  return join(homedir(), ".codeium", "windsurf");
}

function writeWindsurfMcpConfig(
  servers: McpServerConfig[] | Record<string, McpServerConfig>,
  ctx: ConfigureMcpContext & { cwd: string; deployRoots: string[] },
): ConfigureMcpReport {
  const home = resolveWindsurfHome();
  mkdirSync(home, { recursive: true });
  const destFile = join(home, "mcp_config.json");

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
    out[name] = toWindsurfServerEntry(server);
  }
  return { entries: out, diagnostics };
}

function toWindsurfServerEntry(server: McpServerConfig): Record<string, unknown> {
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

  // Bake-mode host: write env values as provided by install (already baked).
  if (server.env && typeof server.env === "object") {
    entry.env = { ...server.env };
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

function materializeWindsurfHooks(args: {
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
  mkdirSync(join(cwd, ".windsurf"), { recursive: true });

  const doc = readHooksDoc(hooksPath);
  const ownership = readOwnershipSidecar(ownershipPath);
  stripOwnedEntries(doc, ownership);
  removeOwnedScripts(cwd, ownership);

  const nextOwned: OwnershipSidecar["owned"] = {};

  for (const p of hooks) {
    const name = sanitizeName(String(p.name));
    const srcPath = p.path ? resolve(p.path) : undefined;
    if (!srcPath || !existsSync(srcPath) || !statSync(srcPath).isFile()) {
      diagnostics.push({
        code: "WINDSURF_HOOK_SOURCE_MISSING",
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
        code: "WINDSURF_HOOK_JSON_INVALID",
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

    for (const [event, entries] of Object.entries(sourceHooks)) {
      if (!Array.isArray(entries)) continue;
      const pascal = toPascalCaseEvent(event);
      const destList = Array.isArray(doc.hooks[pascal]) ? [...doc.hooks[pascal]!] : [];
      for (const entry of entries) {
        if (!entry || typeof entry !== "object") continue;
        const { _apm_source: _drop, ...clean } = entry as HookEntry & { _apm_source?: unknown };
        void _drop;
        const command = typeof clean.command === "string" ? clean.command.trim() : "";
        if (!command) {
          destList.push({ ...clean });
          continue;
        }

        const rewritten = copyHookScript({
          cwd,
          roots,
          hookName: name,
          hookFile: srcPath,
          command,
        });
        const nextEntry: HookEntry = { ...clean, command: rewritten.commandRel };
        destList.push(nextEntry);
        ownedEntries.push({ event: pascal, command: rewritten.commandRel });
        if (rewritten.scriptRel) {
          scripts.push(rewritten.scriptRel);
          deployedFiles.push({
            path: rewritten.scriptRel,
            primitive: { name: String(p.name), packageName: p.packageName },
          });
        }
      }
      doc.hooks[pascal] = destList;
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

function copyHookScript(args: {
  cwd: string;
  roots: string[];
  hookName: string;
  hookFile: string;
  command: string;
}): { commandRel: string; scriptRel?: string } {
  const { cwd, roots, hookName, hookFile, command } = args;
  if (command.includes(".windsurf/hooks/")) {
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

  const destRel = `.windsurf/hooks/${hookName}/${basename(source)}`;
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

function removeOwnedScripts(cwd: string, ownership: OwnershipSidecar): void {
  for (const record of Object.values(ownership.owned ?? {})) {
    for (const script of record.scripts ?? []) {
      const abs = join(cwd, script);
      if (existsSync(abs)) rmSync(abs, { force: true });
    }
  }
}
