/**
 * Create the Hermes target.
 * Detect: never auto-detect — APM models Hermes as stable but explicit-only
 * (`detect_by_dir=False`).
 * Materialize: skills → `.agents/skills/<name>/SKILL.md` at project scope.
 * MCP: `$HERMES_HOME/config.yaml` (`~/.hermes` fallback) with a YAML
 * `mcp_servers:` block, preserving every unrelated native Hermes key.
 * Compile: agents family → project-root `AGENTS.md`.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type {
  BapmIntegration,
  CompileReport,
  ConfigureMcpContext,
  ConfigureMcpReport,
  MaterializeReport,
  McpServerConfig,
} from "@b-apm/integration-api";
import {
  compilePrimitivesMarkdown,
  createMaterializeRun,
  mergeMcpServers,
  normalizeNamedEntries,
  primitivesMaterialize,
  resolveEnvHome,
  skillsOnlyHandlers,
} from "@b-apm/integration-api";

const DEFAULT_DEPLOY_ROOTS = [".agents"] as const;
const MCP_SERVERS_KEY = "mcp_servers";
const CONFIG_FILE_MODE = 0o600;

type JsonObject = Record<string, unknown>;

export type HermesPathOptions = {
  env?: NodeJS.ProcessEnv;
  home?: string;
};

/** Resolve the Hermes home directory, honoring `$HERMES_HOME` like APM. */
export function resolveHermesHome(options: HermesPathOptions = {}): string {
  return resolveEnvHome("HERMES_HOME", [".hermes"], options);
}

export function createHermesIntegration(options?: {
  id?: string;
  deployRoots?: string[];
  /** Test/embedding override; defaults to `$HERMES_HOME/config.yaml`. */
  configPath?: string;
}): BapmIntegration {
  const id = options?.id ?? "hermes";
  const deployRoots = [...(options?.deployRoots ?? DEFAULT_DEPLOY_ROOTS)];
  const configPathOverride = options?.configPath;

  return {
    id,
    deployRoots,
    mcpScope: "home",
    // Hermes has no project marker in APM; select it explicitly.
    detect: () => false,
    getDeployRoots: () => [...deployRoots],
    async compile(primitives, context): Promise<CompileReport> {
      return compilePrimitivesMarkdown(primitives, context, {
        title: "# AGENTS.md",
        defaultOutput: "AGENTS.md",
        requireBasename: "AGENTS.md",
        outsideCwdMessage: "Hermes compile output must be a cwd-relative file path",
      });
    },
    async materialize(primitives, ctx): Promise<MaterializeReport> {
      const run = createMaterializeRun({
        primitives,
        ctx,
        defaultDeployRoots: deployRoots,
        targetId: id,
        requiredRoots: [".agents"],
        label: "hermes",
      });
      const { cwd, roots, deployedFiles, diagnostics } = run;

      await primitivesMaterialize(
        primitives,
        skillsOnlyHandlers({
          cwd,
          deployRoots: roots,
          destDir: ".agents/skills",
          code: "HERMES_PRIMITIVE_UNSUPPORTED",
          label: "hermes",
          deployedFiles,
          diagnostics,
          instructionsHint: "use compile for instructions",
        }),
      );

      return run.report();
    },
    async configureMcp(servers, ctx): Promise<ConfigureMcpReport> {
      return writeHermesMcpConfig(servers, {
        cwd: resolve(ctx?.cwd ?? process.cwd()),
        targetId: ctx?.targetId ?? id,
        managedServers: ctx?.managedServers,
        configPath: configPathOverride,
      });
    },
  };
}

function writeHermesMcpConfig(
  servers: McpServerConfig[] | Record<string, McpServerConfig>,
  ctx: ConfigureMcpContext & { cwd: string; configPath?: string },
): ConfigureMcpReport {
  const configPath = ctx.configPath ?? join(resolveHermesHome(), "config.yaml");
  const document = readHermesDocument(configPath);

  const incoming = normalizeServerEntries(servers);
  const mapped: Record<string, Record<string, unknown>> = {};
  for (const [name, entry] of Object.entries(incoming)) {
    mapped[name] = toHermesServerEntry(entry);
  }

  const merged = mergeMcpServers({
    document,
    key: MCP_SERVERS_KEY,
    incoming: mapped,
    managedServers: ctx.managedServers,
    merge: "replace",
  });
  const nextDocument = merged.document as JsonObject;

  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, stringifyYaml(nextDocument, { lineWidth: 0 }), {
    encoding: "utf8",
    mode: CONFIG_FILE_MODE,
  });
  // atomic/new-file mode only applies on create; tighten an existing file too.
  try {
    chmodSync(configPath, CONFIG_FILE_MODE);
  } catch {
    // Best effort: platforms without POSIX permissions keep the written file.
  }

  return {
    targetId: ctx.targetId,
    configPath,
    servers: merged.servers,
    deployedFiles: [],
  };
}

function readHermesDocument(path: string): JsonObject {
  if (!existsSync(path) || !statSync(path).isFile()) return {};
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (cause) {
    throw new Error(
      `Cannot read Hermes config at "${path}": ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      { cause },
    );
  }
  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (cause) {
    throw new Error(
      `Hermes config at "${path}" is malformed YAML; refusing to overwrite. Fix or remove the file, then retry.`,
      { cause },
    );
  }
  if (parsed === null || parsed === undefined) return {};
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      `Hermes config at "${path}" must contain a YAML mapping; refusing to overwrite. Fix or remove the file, then retry.`,
    );
  }
  const document = parsed as JsonObject;
  if (
    MCP_SERVERS_KEY in document &&
    document[MCP_SERVERS_KEY] !== null &&
    (typeof document[MCP_SERVERS_KEY] !== "object" || Array.isArray(document[MCP_SERVERS_KEY]))
  ) {
    throw new Error(
      `Hermes config at "${path}" has a non-mapping "mcp_servers" value; refusing to overwrite. Fix the file, then retry.`,
    );
  }
  return document;
}

function normalizeServerEntries(
  servers: McpServerConfig[] | Record<string, McpServerConfig>,
): Record<string, McpServerConfig> {
  const out: Record<string, McpServerConfig> = {};
  for (const server of normalizeNamedEntries(servers)) out[server.name] = server;
  return out;
}

/**
 * Convert the portable MCP contract to Hermes' native shape:
 * stdio → command/args/env, remote → url/headers, plus explicit `enabled`.
 */
function toHermesServerEntry(server: McpServerConfig): JsonObject {
  const transport = String(server.transport ?? server.type ?? "").toLowerCase();
  const isRemote =
    Boolean(server.url) ||
    transport === "http" ||
    transport === "sse" ||
    transport === "streamable-http";

  const entry: JsonObject = {};
  if (isRemote) {
    if (server.url) entry.url = server.url;
    if (server.headers && typeof server.headers === "object") {
      entry.headers = { ...server.headers };
    }
  } else {
    if (server.command) entry.command = String(server.command);
    if (Array.isArray(server.args) && server.args.length > 0) entry.args = [...server.args];
    if (server.env && typeof server.env === "object") {
      const env: Record<string, string> = {};
      for (const [key, value] of Object.entries(server.env)) {
        env[key] = String(value);
      }
      if (Object.keys(env).length > 0) entry.env = env;
    }
  }
  entry.enabled = true;
  return entry;
}
