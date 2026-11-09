import { existsSync, mkdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type {
  AttributedPrimitive,
  BapmIntegration,
  ConfigureMcpContext,
  ConfigureMcpReport,
  MaterializeReport,
  McpServerConfig,
} from "@b-apm/integration-api";
import {
  assertUnderDeployRoots,
  createMaterializeRun,
  materializeSkill,
  mergeHookDeployment,
  mergeMcpServers,
  normalizeHookEventName,
  normalizeNamedEntries,
  primitivesMaterialize,
  readJsonDocument,
  readPrimitiveContent,
  resolveEnvHome,
  writeDeployedFile,
  writeJsonDocument,
} from "@b-apm/integration-api";

const DEFAULT_DEPLOY_ROOTS = [".windsurf", ".agents"] as const;
const HOOKS_JSON_REL = ".windsurf/hooks.json";
const HOOKS_OWNERSHIP_REL = ".windsurf/bapm-hooks.json";

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
    mcpScope: "home",
    detect: ({ cwd }) => {
      const dir = join(cwd, ".windsurf");
      return existsSync(dir) && statSync(dir).isDirectory();
    },
    getDeployRoots: () => [...deployRoots],
    async materialize(primitives, ctx): Promise<MaterializeReport> {
      const run = createMaterializeRun({
        primitives,
        ctx,
        defaultDeployRoots: deployRoots,
        targetId: id,
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
              destRel: join(".windsurf", "rules", `${name}.md`),
              content: readPrimitiveContent(p),
              primitive: { name: String(p.name), packageName: p.packageName },
            }),
          );
        },
        command(p, { name }) {
          deployedFiles.push(
            writeDeployedFile({
              cwd,
              deployRoots: roots,
              destRel: join(".windsurf", "workflows", `${name}.md`),
              content: readPrimitiveContent(p),
              primitive: { name: String(p.name), packageName: p.packageName },
            }),
          );
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

      return run.report();
    },
    async configureMcp(servers, ctx): Promise<ConfigureMcpReport> {
      return writeWindsurfMcpConfig(servers, {
        cwd: resolve(ctx?.cwd ?? process.cwd()),
        deployRoots: ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots,
        targetId: ctx?.targetId ?? id,
        managedServers: ctx?.managedServers,
      });
    },
  };
}

export const createIntegration = createWindsurfIntegration;

/** Normalize hook event names to PascalCase (`session_start` / `sessionStart` → `SessionStart`). */
export function toPascalCaseEvent(event: string): string {
  return normalizeHookEventName(event, "pascal");
}

function resolveWindsurfHome(): string {
  return join(resolveEnvHome("CODEIUM_HOME", [".codeium"]), "windsurf");
}

function writeWindsurfMcpConfig(
  servers: McpServerConfig[] | Record<string, McpServerConfig>,
  ctx: ConfigureMcpContext & { cwd: string; deployRoots: string[] },
): ConfigureMcpReport {
  const home = resolveWindsurfHome();
  mkdirSync(home, { recursive: true });
  const destFile = join(home, "mcp_config.json");

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

function normalizeServerEntries(servers: McpServerConfig[] | Record<string, McpServerConfig>): {
  entries: Record<string, Record<string, unknown>>;
  diagnostics: Array<{ code: string; message: string; server?: string }>;
} {
  const out: Record<string, Record<string, unknown>> = {};
  const diagnostics: Array<{ code: string; message: string; server?: string }> = [];

  for (const server of normalizeNamedEntries(servers)) {
    out[server.name] = toWindsurfServerEntry(server);
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
  const hooksPath = join(cwd, HOOKS_JSON_REL);
  const ownershipPath = join(cwd, HOOKS_OWNERSHIP_REL);
  assertUnderDeployRoots(cwd, hooksPath, roots);
  assertUnderDeployRoots(cwd, ownershipPath, roots);
  mkdirSync(join(cwd, ".windsurf"), { recursive: true });

  const result = mergeHookDeployment({
    cwd,
    deployRoots: roots,
    hooks,
    docPath: hooksPath,
    ownershipPath,
    docRel: HOOKS_JSON_REL,
    ownershipRel: HOOKS_OWNERSHIP_REL,
    mode: "flat",
    code: "WINDSURF",
    normalizeEvent: (event) => normalizeHookEventName(event, "pascal"),
    alreadyDeployedNeedle: ".windsurf/hooks/",
    commandAsDotSlash: true,
    versionDefault: 1,
    removeOwnedArtifacts: true,
    scriptDestRel: ({ name, command }) =>
      `.windsurf/hooks/${name}/${basename(command.replace(/^\.\//, ""))}`,
  });

  return { deployedFiles: result.deployedFiles, diagnostics: result.diagnostics };
}
