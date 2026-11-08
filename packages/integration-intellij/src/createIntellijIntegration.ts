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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type {
  BapmIntegration,
  ConfigureMcpContext,
  ConfigureMcpReport,
  MaterializeReport,
  McpServerConfig,
} from "@b-apm/integration-api";
import { primitivesList, pruneManagedMcpServerNames } from "@b-apm/integration-api";

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

  const configured = env.XDG_CONFIG_HOME?.trim();
  if (configured && !isAbsolute(configured)) {
    throw new Error(
      "XDG_CONFIG_HOME must be an absolute path; cannot locate the JetBrains Copilot MCP configuration directory",
    );
  }
  const root = configured || join(home, ".config");
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
  const existingServers =
    existing[SERVERS_KEY] && typeof existing[SERVERS_KEY] === "object"
      ? { ...(existing[SERVERS_KEY] as Record<string, JsonObject>) }
      : {};

  const incoming = normalizeServerEntries(servers);
  const nextServers: Record<string, JsonObject> = { ...existingServers };
  pruneManagedMcpServerNames(nextServers, Object.keys(incoming), ctx.managedServers);

  for (const [name, entry] of Object.entries(incoming)) {
    const prior = existingServers[name];
    nextServers[name] = prior && typeof prior === "object" ? { ...prior, ...entry } : { ...entry };
  }

  const doc: JsonObject = { ...existing, [SERVERS_KEY]: nextServers };
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");

  return {
    targetId: ctx.targetId,
    configPath,
    servers: Object.keys(incoming),
    deployedFiles: [],
  };
}

function readIntellijConfig(path: string): JsonObject {
  if (!existsSync(path)) return {};
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (cause) {
    throw new Error(
      `Cannot read JetBrains Copilot MCP config at "${path}": ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      { cause },
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonc(raw));
  } catch (cause) {
    throw new Error(
      `JetBrains Copilot MCP config at "${path}" is malformed JSON: ${
        cause instanceof Error ? cause.message : String(cause)
      }. Fix the file, then rerun bapm install.`,
      { cause },
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      `JetBrains Copilot MCP config at "${path}" must contain a JSON object. Fix the file, then rerun bapm install.`,
    );
  }
  const doc = parsed as JsonObject;
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
  const list: McpServerConfig[] = Array.isArray(servers)
    ? servers
    : Object.entries(servers).map(([name, value]) => ({ ...value, name: value.name ?? name }));

  const out: Record<string, JsonObject> = {};
  for (const server of list) {
    const name = String(server.name ?? "").trim();
    if (!name) continue;
    out[name] = toIntellijServerEntry(server);
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
      entry.headers = translateEnvPlaceholders(server.headers);
    }
  } else {
    if (server.command) entry.command = String(server.command);
    if (Array.isArray(server.args)) entry.args = server.args;
    if (server.env && typeof server.env === "object") {
      entry.env = translateEnvPlaceholders(server.env);
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

function translateEnvPlaceholders(values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(values)) {
    if (typeof raw !== "string") {
      out[key] = String(raw);
      continue;
    }
    out[key] = raw
      .replace(/\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}/g, "${env:$1}")
      .replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, "${env:$1}")
      .replace(/<([A-Z_][A-Z0-9_]*)>/g, "${env:$1}");
  }
  return out;
}

/** Strip JSONC comments and trailing commas so IntelliJ's native file is readable. */
function stripJsonc(raw: string): string {
  const chars = raw.split("");
  let inString = false;
  let escaped = false;
  let index = 0;
  while (index < chars.length) {
    const char = chars[index]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      index += 1;
      continue;
    }
    if (char === '"') {
      inString = true;
      index += 1;
      continue;
    }
    if (char === "/" && chars[index + 1] === "/") {
      while (index < chars.length && chars[index] !== "\n" && chars[index] !== "\r") {
        chars[index] = " ";
        index += 1;
      }
      continue;
    }
    if (char === "/" && chars[index + 1] === "*") {
      const end = raw.indexOf("*/", index + 2);
      const stop = end === -1 ? chars.length : end + 2;
      while (index < stop) {
        if (chars[index] !== "\n" && chars[index] !== "\r") chars[index] = " ";
        index += 1;
      }
      continue;
    }
    if (char === ",") {
      let next = index + 1;
      while (next < chars.length && /\s/.test(chars[next]!)) next += 1;
      if (chars[next] === "}" || chars[next] === "]") {
        chars[index] = " ";
      }
    }
    index += 1;
  }
  return chars.join("");
}

export { stripJsonc as stripIntellijJsonc };
