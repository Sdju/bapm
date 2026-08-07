import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { isWithin, loadAgentPluginManifest } from "./load.ts";
import type {
  AgentPluginDiagnostic,
  AgentPluginMcpServer,
  DiscoverAgentPluginMcpOptions,
  DiscoverAgentPluginMcpResult,
} from "./types.ts";

const RESERVED_ENV = new Set(["PLUGIN_ROOT", "PLUGIN_DATA"]);
const SECRET_ENV = /(?:secret|token|password|api[_-]?key|authorization|cookie)/i;

/** Parse only `<plugin root>/mcp.json`; a bad file never invalidates skills. */
export function discoverAgentPluginMcp(
  options: DiscoverAgentPluginMcpOptions,
): DiscoverAgentPluginMcpResult {
  const loaded = loadAgentPluginManifest(options);
  const diagnostics = [...loaded.diagnostics];
  const candidate = join(loaded.root, "mcp.json");
  if (!existsSync(candidate)) return { ...loaded, diagnostics, servers: [] };

  let path: string;
  let value: unknown;
  try {
    path = realpathSync(candidate);
    if (!isWithin(loaded.root, path) || !statSync(path).isFile()) throw new Error("not contained");
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    diagnostics.push(diag("AGENT_PLUGIN_MCP_INVALID", "Ignoring invalid mcp.json", candidate));
    return { ...loaded, diagnostics, servers: [] };
  }
  if (!isObject(value) || !isObject(value.mcpServers)) {
    diagnostics.push(
      diag("AGENT_PLUGIN_MCP_INVALID", 'Ignoring mcp.json without object "mcpServers"', path),
    );
    return { ...loaded, diagnostics, servers: [] };
  }

  const dataRoot = resolve(options.dataRoot);
  const servers: AgentPluginMcpServer[] = [];
  for (const [name, server] of Object.entries(value.mcpServers)) {
    const parsed = parseServer(name, server, loaded.root, dataRoot);
    if (typeof parsed === "object" && "code" in parsed) {
      diagnostics.push(diag(parsed.code, `Ignoring MCP server "${name}": ${parsed.message}`, path));
    } else {
      servers.push(parsed);
    }
  }
  return { ...loaded, diagnostics, servers };
}

function parseServer(
  name: string,
  raw: unknown,
  root: string,
  dataRoot: string,
): AgentPluginMcpServer | { code: string; message: string } {
  if (!name.trim() || !isObject(raw))
    return { code: "AGENT_PLUGIN_MCP_SERVER_INVALID", message: "must be an object with a name" };
  const type = raw.type ?? raw.transport;
  if (type !== "stdio" && type !== "streamable-http" && type !== "sse") {
    return { code: "AGENT_PLUGIN_MCP_SERVER_INVALID", message: "uses an unsupported transport" };
  }
  const env = parseEnv(raw.env);
  if (isServerError(env)) return env;
  if (type === "stdio") {
    if (typeof raw.command !== "string" || raw.command.length === 0) {
      return { code: "AGENT_PLUGIN_MCP_SERVER_INVALID", message: "stdio requires command" };
    }
    if (
      raw.args !== undefined &&
      (!Array.isArray(raw.args) || !raw.args.every((x) => typeof x === "string"))
    ) {
      return { code: "AGENT_PLUGIN_MCP_SERVER_INVALID", message: "args must be strings" };
    }
    const cwd = parseContainedPath(raw.cwd, root, dataRoot);
    if (isServerError(cwd)) return cwd;
    return {
      name: name.trim(),
      transport: type,
      command: substitute(raw.command, root, dataRoot),
      args: (raw.args as string[] | undefined)?.map((arg) => substitute(arg, root, dataRoot)),
      cwd,
      env: { ...env, PLUGIN_ROOT: root, PLUGIN_DATA: dataRoot },
      format: "agent-plugin",
    };
  }
  if (typeof raw.url !== "string" || !isSafeHttpUrl(raw.url)) {
    return { code: "AGENT_PLUGIN_MCP_SERVER_INVALID", message: `${type} requires an http(s) url` };
  }
  if (raw.cwd !== undefined || raw.command !== undefined || raw.args !== undefined) {
    return {
      code: "AGENT_PLUGIN_MCP_SERVER_INVALID",
      message: `${type} cannot declare stdio fields`,
    };
  }
  return {
    name: name.trim(),
    transport: type,
    url: raw.url,
    env: { ...env, PLUGIN_ROOT: root, PLUGIN_DATA: dataRoot },
    format: "agent-plugin",
  };
}

function parseEnv(value: unknown): Record<string, string> | { code: string; message: string } {
  if (value === undefined) return {};
  if (!isObject(value))
    return { code: "AGENT_PLUGIN_MCP_SERVER_INVALID", message: "env must be an object" };
  const env: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || typeof item !== "string") {
      return { code: "AGENT_PLUGIN_MCP_SERVER_INVALID", message: "env contains an invalid entry" };
    }
    if (RESERVED_ENV.has(key))
      return { code: "AGENT_PLUGIN_MCP_ENV_RESERVED", message: `env may not override ${key}` };
    if (SECRET_ENV.test(key))
      return {
        code: "AGENT_PLUGIN_MCP_SECRET_REFUSED",
        message: `env may not supply secret ${key}`,
      };
    env[key] = item;
  }
  return env;
}

function parseContainedPath(
  value: unknown,
  root: string,
  dataRoot: string,
): string | undefined | { code: string; message: string } {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0)
    return { code: "AGENT_PLUGIN_MCP_PATH_INVALID", message: "cwd must be a path string" };
  const expanded = substitute(value, root, dataRoot);
  const path = isAbsolute(expanded) ? resolve(expanded) : resolve(root, expanded);
  if (!isWithin(root, path) && !isWithin(dataRoot, path)) {
    return {
      code: "AGENT_PLUGIN_MCP_PATH_ESCAPE",
      message: "cwd escapes plugin root or plugin data",
    };
  }
  // Existing paths must not escape through a symlink.
  if (existsSync(path)) {
    try {
      const real = realpathSync(path);
      if (!isWithin(root, real) && !isWithin(dataRoot, real)) {
        return {
          code: "AGENT_PLUGIN_MCP_PATH_ESCAPE",
          message: "cwd resolves outside plugin root or plugin data",
        };
      }
    } catch {
      return { code: "AGENT_PLUGIN_MCP_PATH_INVALID", message: "cwd cannot be resolved" };
    }
  }
  return path;
}

function substitute(value: string, root: string, dataRoot: string): string {
  return value.replace(/\$\{(PLUGIN_ROOT|PLUGIN_DATA)\}/g, (_, name: string) =>
    name === "PLUGIN_ROOT" ? root : dataRoot,
  );
}

function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isServerError(value: unknown): value is { code: string; message: string } {
  return isObject(value) && typeof value.code === "string" && typeof value.message === "string";
}

function diag(code: string, message: string, path: string): AgentPluginDiagnostic {
  return { code, message, path, severity: "warning" };
}
