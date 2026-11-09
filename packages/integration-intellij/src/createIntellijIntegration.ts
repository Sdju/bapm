/**
 * Create the IntelliJ (JetBrains Copilot) target.
 * APM models `intellij` as an MCP-only target that reuses the Copilot
 * primitive profile. bapm keeps the same MCP-only contract: no file
 * materialize and no compile output.
 *
 * MCP path (APM `adapters/client/intellij.py`):
 *   Windows: %LOCALAPPDATA%\github-copilot\intellij\mcp.json
 *   macOS/Linux: $XDG_CONFIG_HOME/github-copilot/intellij/mcp.json
 * The file is always user-scope and uses a top-level `servers` object.
 */
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type {
  BapmIntegration,
  ConfigureMcpContext,
  ConfigureMcpReport,
  MaterializeReport,
  McpServerConfig,
} from "@b-apm/integration-api";
import {
  mergeMcpServers,
  normalizeNamedEntries,
  primitivesList,
  readJsonDocument,
  resolveXdgConfigHome,
  stripJsonc,
  translateEnvMap,
  writeJsonDocument,
} from "@b-apm/integration-api";

const DEFAULT_DEPLOY_ROOTS: string[] = [];
const SERVERS_KEY = "servers";

type JsonObject = Record<string, unknown>;

export type IntellijPathOptions = {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  home?: string;
};

/** Resolve JetBrains Copilot's canonical user-scope `mcp.json` path. */
export function resolveIntellijMcpPath(options: IntellijPathOptions = {}): string {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const home = options.home ?? homedir();

  if (platform === "win32") {
    const localAppData = env.LOCALAPPDATA?.trim();
    if (!localAppData) {
      throw new Error(
        "LOCALAPPDATA is unset; cannot locate the JetBrains Copilot MCP configuration directory",
      );
    }
    return join(localAppData, "github-copilot", "intellij", "mcp.json");
  }

  const root = resolveXdgConfigHome({ env, home });
  return join(root, "github-copilot", "intellij", "mcp.json");
}

export function createIntellijIntegration(options?: {
  id?: string;
  deployRoots?: string[];
  /** Test/embedding override; defaults to the APM platform path. */
  configPath?: string;
}): BapmIntegration {
  const id = options?.id ?? "intellij";
  const deployRoots = [...(options?.deployRoots ?? DEFAULT_DEPLOY_ROOTS)];
  const configPathOverride = options?.configPath;

  return {
    id,
    deployRoots,
    mcpScope: "home",
    mcpEnvMode: "translate",
    // IntelliJ has no project marker in APM; select it explicitly.
    detect: () => false,
    getDeployRoots: () => [...deployRoots],
    async materialize(primitives): Promise<MaterializeReport> {
      const list = primitivesList(primitives);
      const diagnostics: NonNullable<MaterializeReport["diagnostics"]> =
        list.length === 0
          ? []
          : [
              {
                code: "INTELLIJ_PRIMITIVE_UNSUPPORTED",
                message:
                  "IntelliJ integration is MCP-only; file primitives are not deployed for intellij",
                kind: "primitive",
              },
            ];
      return {
        targetId: id,
        deployedFiles: [],
        ...(diagnostics.length > 0 ? { diagnostics } : {}),
      };
    },
    async configureMcp(servers, ctx): Promise<ConfigureMcpReport> {
      return writeIntellijMcpConfig(servers, {
        cwd: resolve(ctx?.cwd ?? process.cwd()),
        targetId: ctx?.targetId ?? id,
        managedServers: ctx?.managedServers,
        configPath: configPathOverride,
      });
    },
  };
}

function writeIntellijMcpConfig(
  servers: McpServerConfig[] | Record<string, McpServerConfig>,
  ctx: ConfigureMcpContext & { cwd: string; configPath?: string },
): ConfigureMcpReport {
  const configPath = ctx.configPath ?? resolveIntellijMcpPath();
  const existing = readIntellijConfig(configPath);

  const incoming = normalizeServerEntries(servers);
  const merged = mergeMcpServers({
    document: existing,
    key: SERVERS_KEY,
    incoming,
    managedServers: ctx.managedServers,
    merge: "shallow",
  });
  writeJsonDocument(configPath, merged.document);

  return {
    targetId: ctx.targetId,
    configPath,
    servers: merged.servers,
    deployedFiles: [],
  };
}

function readIntellijConfig(path: string): JsonObject {
  const doc = readJsonDocument({
    path,
    strict: true,
    jsonc: true,
    label: `JetBrains Copilot MCP config at "${path}"`,
  });
  if (SERVERS_KEY in doc) {
    const servers = doc[SERVERS_KEY];
    if (!servers || typeof servers !== "object" || Array.isArray(servers)) {
      throw new Error(
        `JetBrains Copilot MCP config at "${path}" has a non-object "servers" value. Fix the file, then rerun bapm install.`,
      );
    }
  }
  return doc;
}

function normalizeServerEntries(
  servers: McpServerConfig[] | Record<string, McpServerConfig>,
): Record<string, JsonObject> {
  const out: Record<string, JsonObject> = {};
  for (const server of normalizeNamedEntries(servers)) {
    out[server.name] = toIntellijServerEntry(server);
  }
  return out;
}

function toIntellijServerEntry(server: McpServerConfig): JsonObject {
  const transport = String(server.transport ?? server.type ?? "").toLowerCase();
  const isRemote =
    transport === "http" ||
    transport === "sse" ||
    transport === "streamable-http" ||
    typeof server.url === "string";

  const entry: JsonObject = {
    type: isRemote ? "http" : "local",
    tools: Array.isArray(server.tools) ? server.tools : ["*"],
    id: typeof server.id === "string" ? server.id : "",
  };

  if (isRemote) {
    if (server.url) entry.url = server.url;
    if (server.headers && typeof server.headers === "object") {
      entry.headers = translateEnvMap(server.headers, "dollar-env");
    }
  } else {
    if (server.command) entry.command = String(server.command);
    if (Array.isArray(server.args)) entry.args = server.args;
    if (server.env && typeof server.env === "object") {
      entry.env = translateEnvMap(server.env, "dollar-env");
    }
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
        "headers",
        "tools",
        "id",
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

/** Strip JSONC comments and trailing commas so IntelliJ's native file is readable. */
export { stripJsonc as stripIntellijJsonc };
