/**
 * MCP server registry lookup (MCP Registry v0 API shape).
 *
 * The transport is injected so callers and tests can substitute a mock HTTP
 * port. Production uses the shared Registry fetch transport, which already
 * implements the opt-in `BAPM_CACHE_DIR` HTTP cache, redirect-safe auth drop,
 * and TLS trust hints. Requests carrying an Authorization header bypass the
 * cache (the shared transport owns that rule).
 */
import {
  createFetchTransport,
  joinRegistryUrl,
  type RegistryHttpRequest,
  type RegistryHttpResponse,
} from "@/modules/Registry";
import type { McpServerConfig } from "@b-apm/integration-api";

/** Public default used by APM / MCP Registry clients. */
export const DEFAULT_MCP_REGISTRY_URL = "https://api.mcp.github.com";
export const MCP_REGISTRY_URL_ENV = "MCP_REGISTRY_URL";
export const MCP_REGISTRY_ALLOW_HTTP_ENV = "MCP_REGISTRY_ALLOW_HTTP";
/** Optional bearer token for private MCP registries. Never echoed in output. */
export const MCP_REGISTRY_TOKEN_ENV = "MCP_REGISTRY_TOKEN";
/** Alias for callers that prefer the bapm namespace. */
export const BAPM_MCP_REGISTRY_TOKEN_ENV = "BAPM_MCP_REGISTRY_TOKEN";

const MAX_REGISTRY_JSON_BYTES = 10 * 1024 * 1024;
const MAX_REGISTRY_URL_LENGTH = 2048;
const SERVER_NAME_RE = /^[A-Za-z0-9._~-]+(\/[A-Za-z0-9._~-]+)?$/;

export type McpRegistrySource = "explicit" | "env" | "config" | "default";
export type McpRegistryEnv = Record<string, string | undefined>;

export type ResolvedMcpRegistryUrl = {
  url: string;
  source: McpRegistrySource;
};

export type McpRegistryErrorCode =
  | "MCP_REGISTRY_URL"
  | "MCP_REGISTRY_HTTP"
  | "MCP_REGISTRY_AUTH"
  | "MCP_REGISTRY_PARSE"
  | "MCP_REGISTRY_NOT_FOUND"
  | "MCP_REGISTRY_UNSUPPORTED";

export class McpRegistryError extends Error {
  readonly code: McpRegistryErrorCode;
  readonly details?: Record<string, unknown>;
  readonly status?: number;

  constructor(
    code: McpRegistryErrorCode,
    message: string,
    options?: { details?: Record<string, unknown>; cause?: unknown; status?: number },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "McpRegistryError";
    this.code = code;
    this.details = options?.details;
    this.status = options?.status;
  }
}

/** Injectable sync/async HTTP port. */
export type McpRegistryTransport = {
  fetch(request: RegistryHttpRequest): RegistryHttpResponse | Promise<RegistryHttpResponse>;
};

export type ResolveMcpRegistryUrlOptions = {
  /** `--registry` or a per-dependency `registry:` URL. Blank values are absent. */
  explicit?: string;
  /** Persisted `mcp-registry-url` from user config. */
  configuredUrl?: string;
  /** Defaults to `process.env`. */
  env?: McpRegistryEnv;
  /** Explicit plaintext-HTTP consent (the `--registry` flag is consent). */
  allowHttp?: boolean;
};

/**
 * Resolve the MCP registry endpoint with APM-compatible precedence:
 * explicit > `MCP_REGISTRY_URL` > persisted `mcp-registry-url` > public default.
 *
 * `http://` is accepted for explicit/config URLs; the ambient env var requires
 * `MCP_REGISTRY_ALLOW_HTTP=1` (or an injected `allowHttp`) so a poisoned
 * environment cannot silently redirect a lookup to plaintext.
 */
export function resolveMcpRegistryUrl(
  options: ResolveMcpRegistryUrlOptions = {},
): ResolvedMcpRegistryUrl {
  const env = options.env ?? process.env;
  const explicit = nonEmpty(options.explicit);
  if (explicit) {
    return {
      url: normalizeMcpRegistryUrl(explicit, {
        source: "explicit",
        allowHttp: options.allowHttp !== false,
      }),
      source: "explicit",
    };
  }
  const fromEnv = nonEmpty(env[MCP_REGISTRY_URL_ENV]);
  if (fromEnv) {
    const allowHttp = options.allowHttp === true || envFlag(env[MCP_REGISTRY_ALLOW_HTTP_ENV]);
    return {
      url: normalizeMcpRegistryUrl(fromEnv, { source: "env", allowHttp }),
      source: "env",
    };
  }
  const configured = nonEmpty(options.configuredUrl);
  if (configured) {
    return {
      url: normalizeMcpRegistryUrl(configured, { source: "config", allowHttp: true }),
      source: "config",
    };
  }
  return { url: DEFAULT_MCP_REGISTRY_URL, source: "default" };
}

/** Validate and normalize a registry base URL (trailing slash removed). */
export function normalizeMcpRegistryUrl(
  raw: string,
  options: { source?: McpRegistrySource; allowHttp?: boolean } = {},
): string {
  const value = raw.trim().replace(/\/+$/, "");
  const source = options.source ?? "explicit";
  const hint = registrySourceHint(source);
  if (!value) {
    throw new McpRegistryError(
      "MCP_REGISTRY_URL",
      `Invalid MCP registry URL: expected scheme://host (e.g. https://mcp.example.com). ${hint}`.trim(),
    );
  }
  if (value.length > MAX_REGISTRY_URL_LENGTH) {
    throw new McpRegistryError(
      "MCP_REGISTRY_URL",
      `Invalid MCP registry URL: too long (${value.length} > ${MAX_REGISTRY_URL_LENGTH} characters). ${hint}`.trim(),
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch (cause) {
    throw new McpRegistryError(
      "MCP_REGISTRY_URL",
      `Invalid MCP registry URL ${JSON.stringify(redactMcpRegistryUrl(value))}: expected scheme://host (e.g. https://mcp.example.com). ${hint}`.trim(),
      { cause },
    );
  }
  const scheme = parsed.protocol.replace(/:$/, "").toLowerCase();
  if (scheme !== "http" && scheme !== "https") {
    throw new McpRegistryError(
      "MCP_REGISTRY_URL",
      `Invalid MCP registry URL ${JSON.stringify(redactMcpRegistryUrl(value))}: unsupported scheme "${scheme}"; use http:// or https://. ${hint}`.trim(),
    );
  }
  if (!parsed.hostname) {
    throw new McpRegistryError(
      "MCP_REGISTRY_URL",
      `Invalid MCP registry URL ${JSON.stringify(redactMcpRegistryUrl(value))}: expected an http(s) URL with a host. ${hint}`.trim(),
    );
  }
  if (parsed.username || parsed.password) {
    throw new McpRegistryError(
      "MCP_REGISTRY_URL",
      `Invalid MCP registry URL: embedded credentials are not supported; set ${MCP_REGISTRY_TOKEN_ENV} instead. ${hint}`.trim(),
    );
  }
  if (parsed.search || parsed.hash) {
    throw new McpRegistryError(
      "MCP_REGISTRY_URL",
      `Invalid MCP registry URL ${JSON.stringify(redactMcpRegistryUrl(value))}: query strings and fragments are not supported. ${hint}`.trim(),
    );
  }
  if (scheme === "http" && options.allowHttp !== true && source !== "config") {
    throw new McpRegistryError(
      "MCP_REGISTRY_URL",
      `Insecure MCP registry URL ${JSON.stringify(redactMcpRegistryUrl(value))}: http:// is not allowed by default. Set ${MCP_REGISTRY_ALLOW_HTTP_ENV}=1 to opt in, or use a localhost/private registry explicitly. ${hint}`.trim(),
    );
  }
  // Rebuild without credentials/query/fragment and with a stable trailing slash.
  // `URL.host` keeps IPv6 brackets and the explicit port while dropping userinfo.
  const pathname = parsed.pathname.replace(/\/+$/, "");
  return `${scheme}://${parsed.host}${pathname}`;
}

/** Safe registry URL for terminal/log output (no credentials/query/fragment). */
export function redactMcpRegistryUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    const pathname = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.protocol}//${parsed.host}${pathname}`;
  } catch {
    return "<invalid registry URL>";
  }
}

export type McpRegistryPackage = {
  registryType: string;
  identifier: string;
  version?: string;
  runtimeHint?: string;
  runtimeArguments: string[];
  packageArguments: string[];
  environmentVariables: McpRegistryEnvironmentVariable[];
};

export type McpRegistryEnvironmentVariable = {
  name: string;
  required: boolean;
  secret: boolean;
  defaultValue?: string;
};

export type McpRegistryRemoteHeader = {
  name: string;
  /** Registry-authored value; public output MUST strip this. */
  value?: string;
};

export type McpRegistryRemote = {
  type: string;
  url: string;
  headers: McpRegistryRemoteHeader[];
};

/** Stable summary returned by `mcp search` and embedded in `mcp show`. */
export type McpRegistryServerSummary = {
  name: string;
  description: string | null;
  version: string | null;
  transports: string[];
  packages: Array<{
    registryType: string;
    identifier: string;
    version?: string;
    runtimeHint?: string;
  }>;
};

export type McpRegistryServerDetails = McpRegistryServerSummary & {
  repositoryUrl: string | null;
  websiteUrl: string | null;
  remotes: McpRegistryRemote[];
  packageDetails: McpRegistryPackage[];
};

export type McpRegistrySearchOptions = { limit?: number };
export type McpRegistryGetServerOptions = {
  version?: string;
  /** Per-entry `registry:` URL override. */
  registryUrl?: string;
};
export type McpRegistryLookup = {
  getServer(name: string, options?: McpRegistryGetServerOptions): Promise<McpRegistryServerDetails>;
};

export type CreateMcpRegistryClientOptions = ResolveMcpRegistryUrlOptions & {
  baseUrl?: string;
  url?: string;
  registryUrl?: string;
  transport?: McpRegistryTransport;
  token?: string;
  maxJsonBytes?: number;
  /** API prefix; MCP Registry v0 is `/v0`. */
  apiPrefix?: string;
};

export type McpRegistryClient = McpRegistryLookup & {
  baseUrl: string;
  source: McpRegistrySource;
  searchServers(
    query: string,
    options?: McpRegistrySearchOptions,
  ): Promise<McpRegistryServerSummary[]>;
};

export function createMcpRegistryClient(
  options: CreateMcpRegistryClientOptions = {},
): McpRegistryClient {
  const explicitBase = nonEmpty(options.baseUrl ?? options.url ?? options.registryUrl);
  const resolved = explicitBase
    ? {
        url: normalizeMcpRegistryUrl(explicitBase, {
          source: "explicit",
          allowHttp: options.allowHttp !== false,
        }),
        source: "explicit" as const,
      }
    : resolveMcpRegistryUrl(options);
  const env = options.env ?? process.env;
  const transport: McpRegistryTransport = options.transport ?? createFetchTransport({ env });
  const token =
    nonEmpty(options.token) ??
    nonEmpty(env[MCP_REGISTRY_TOKEN_ENV]) ??
    nonEmpty(env[BAPM_MCP_REGISTRY_TOKEN_ENV]);
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const maxJsonBytes = options.maxJsonBytes ?? MAX_REGISTRY_JSON_BYTES;
  const apiPrefix = normalizeApiPrefix(options.apiPrefix);

  const getJson = async (url: string, registryBase = resolved.url): Promise<unknown> => {
    let res: RegistryHttpResponse;
    try {
      res = await transport.fetch({ method: "GET", url, headers });
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      throw new McpRegistryError(
        "MCP_REGISTRY_HTTP",
        `Could not reach MCP registry at ${redactMcpRegistryUrl(registryBase)}: ${detail}`,
        { cause, details: { registry: redactMcpRegistryUrl(registryBase) } },
      );
    }
    if (res.status === 404) {
      throw new McpRegistryError(
        "MCP_REGISTRY_NOT_FOUND",
        `Not found in MCP registry ${redactMcpRegistryUrl(registryBase)}`,
        { status: 404, details: { url } },
      );
    }
    if (res.status < 200 || res.status >= 300) {
      const auth = res.status === 401 || res.status === 403;
      throw new McpRegistryError(
        auth ? "MCP_REGISTRY_AUTH" : "MCP_REGISTRY_HTTP",
        auth
          ? `MCP registry ${redactMcpRegistryUrl(registryBase)} returned ${res.status} (unauthorized/forbidden). Set ${MCP_REGISTRY_TOKEN_ENV} if this is a private registry.`
          : `MCP registry ${redactMcpRegistryUrl(registryBase)} returned HTTP ${res.status}.`,
        { status: res.status, details: { url } },
      );
    }
    if (res.body.byteLength > maxJsonBytes) {
      throw new McpRegistryError(
        "MCP_REGISTRY_PARSE",
        `MCP registry response exceeds the ${maxJsonBytes} byte JSON cap.`,
        { details: { url, size: res.body.byteLength } },
      );
    }
    const text = new TextDecoder().decode(res.body);
    if (!text.trim()) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch (cause) {
      throw new McpRegistryError(
        "MCP_REGISTRY_PARSE",
        `MCP registry response is not valid JSON for ${redactMcpRegistryUrl(registryBase)}.`,
        { cause, details: { url } },
      );
    }
  };

  return {
    baseUrl: resolved.url,
    source: resolved.source,
    async searchServers(query, searchOptions = {}) {
      const base = joinRegistryUrl(resolved.url, `${apiPrefix}/servers`);
      const params = new URLSearchParams();
      const trimmed = String(query ?? "").trim();
      if (trimmed) params.set("search", trimmed);
      if (searchOptions.limit !== undefined && Number.isFinite(searchOptions.limit)) {
        params.set("limit", String(Math.max(1, Math.trunc(searchOptions.limit))));
      }
      const suffix = params.size > 0 ? `?${params.toString()}` : "";
      const data = await getJson(`${base}${suffix}`);
      const servers = serverList(data);
      return servers.map((server) => toSummary(server));
    },
    async getServer(name, serverOptions = {}) {
      const serverName = String(name ?? "").trim();
      if (!SERVER_NAME_RE.test(serverName)) {
        throw new McpRegistryError(
          "MCP_REGISTRY_URL",
          `Invalid MCP server name ${JSON.stringify(serverName)}: expected a reverse-DNS identifier, optionally with a single "/<repo>" suffix.`,
        );
      }
      const baseUrl = nonEmpty(serverOptions.registryUrl)
        ? normalizeMcpRegistryUrl(serverOptions.registryUrl!, {
            source: "explicit",
            allowHttp: true,
          })
        : resolved.url;
      const version = nonEmpty(serverOptions.version) ?? "latest";
      const url = joinRegistryUrl(
        baseUrl,
        `${apiPrefix}/servers/${encodeURIComponent(serverName)}/versions/${encodeURIComponent(version)}`,
      );
      const data = await getJson(url, baseUrl);
      const server = unwrapSingleServer(data);
      if (!server) {
        throw new McpRegistryError(
          "MCP_REGISTRY_NOT_FOUND",
          `Server "${serverName}" not found in MCP registry ${redactMcpRegistryUrl(baseUrl)}.`,
          { status: 404, details: { name: serverName } },
        );
      }
      return toDetails(server);
    },
  };
}

/** Strip registry-authored header values before printing JSON/terminal output. */
export function redactMcpRegistryDetails(details: McpRegistryServerDetails): Omit<
  McpRegistryServerDetails,
  "remotes" | "packageDetails"
> & {
  remotes: Array<{ type: string; url: string; headers: string[] }>;
  packageDetails: Array<
    Omit<McpRegistryPackage, "environmentVariables"> & {
      environmentVariables: Array<Omit<McpRegistryEnvironmentVariable, "defaultValue">>;
    }
  >;
} {
  return {
    ...details,
    remotes: details.remotes.map((remote) => ({
      type: remote.type,
      url: remote.url,
      headers: remote.headers.map((header) => header.name),
    })),
    packageDetails: details.packageDetails.map((pkg) => ({
      ...pkg,
      environmentVariables: pkg.environmentVariables.map((variable) => ({
        name: variable.name,
        required: variable.required,
        secret: variable.secret,
      })),
    })),
  };
}

export type McpRegistryDeclOverlay = {
  transport?: string;
  type?: string;
  command?: string;
  args?: unknown[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
};

export type McpRegistryServerResolution = {
  server: McpServerConfig & { registry: false };
  diagnostics: Array<{ code: string; message: string; warn?: boolean }>;
};

/**
 * Convert a registry detail into the host-agnostic MCP server contract.
 *
 * This mirrors APM's adapter selection conservatively: npm > docker > pypi >
 * homebrew > first package, with remote endpoints used only when no package is
 * installable or the declaration explicitly selects a remote transport.
 */
export function resolveMcpServerFromRegistry(
  details: McpRegistryServerDetails,
  overlay: McpRegistryDeclOverlay = {},
): McpRegistryServerResolution {
  const diagnostics: McpRegistryServerResolution["diagnostics"] = [];
  const explicitTransport = normalizeTransport(overlay.transport ?? overlay.type);
  const wantsRemote =
    explicitTransport === "http" ||
    explicitTransport === "sse" ||
    explicitTransport === "streamable-http";
  const wantsStdio = explicitTransport === "stdio";

  const remote =
    wantsRemote || (!wantsStdio && details.packageDetails.length === 0)
      ? pickRemote(details.remotes)
      : undefined;
  if (remote) {
    const transport = explicitTransport ?? normalizeTransport(remote.type) ?? "http";
    const headers = mergeHeaders(headersFromRegistry(remote), overlay.headers);
    return {
      server: {
        name: details.name,
        registry: false,
        transport,
        url: overlay.url ?? remote.url,
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
        ...(overlay.env && Object.keys(overlay.env).length > 0 ? { env: { ...overlay.env } } : {}),
      },
      diagnostics,
    };
  }

  const selected = pickPackage(details.packageDetails);
  if (!selected) {
    throw new McpRegistryError(
      "MCP_REGISTRY_UNSUPPORTED",
      `MCP registry server "${details.name}" has no installable package or remote endpoint.`,
      { details: { name: details.name } },
    );
  }
  const identifier = selected.identifier.trim();
  if (!identifier) {
    throw new McpRegistryError(
      "MCP_REGISTRY_UNSUPPORTED",
      `MCP registry server "${details.name}" has a package without an identifier.`,
      { details: { name: details.name } },
    );
  }
  const registryType = (selected.registryType || inferRegistryType(selected)).toLowerCase();
  const runtimeHint = selected.runtimeHint?.trim();
  const runtimeArgs = selected.runtimeArguments;
  const packageArgs = selected.packageArguments;
  const overlayArgs = (overlay.args ?? []).map((arg) => String(arg));

  let command: string;
  let args: string[];
  if (registryType === "docker" || registryType === "oci") {
    command = runtimeHint || "docker";
    args = [
      ...(command === "docker" ? ["run", "-i", "--rm"] : []),
      ...runtimeArgs,
      ...packageArgs,
      ...overlayArgs,
      identifier,
    ];
  } else if (registryType === "pypi" || registryType === "python") {
    command = runtimeHint || "uvx";
    args = [...runtimeArgs, identifier, ...packageArgs, ...overlayArgs];
  } else if (registryType === "homebrew" || registryType === "brew") {
    command = runtimeHint || identifier.split("/").pop() || identifier;
    args = [...runtimeArgs, ...packageArgs, ...overlayArgs];
  } else {
    command = overlay.command ?? runtimeHint ?? (registryType === "nuget" ? "dnx" : "npx");
    const prefix = command === "npx" || command === "bunx" ? ["-y"] : [];
    args = [...prefix, ...runtimeArgs, identifier, ...packageArgs, ...overlayArgs];
  }

  const env = mergeEnv(envFromRegistry(selected), overlay.env);
  const headers = mergeHeaders({}, overlay.headers);
  for (const variable of selected.environmentVariables) {
    if (variable.required && env[variable.name] === undefined) {
      diagnostics.push({
        code: "MCP_REGISTRY_ENV_REQUIRED",
        message: `MCP registry server "${details.name}" requires env ${variable.name}; add it to dependencies.mcp env or the project environment.`,
        warn: true,
      });
    }
  }
  return {
    server: {
      name: details.name,
      registry: false,
      transport: "stdio",
      command: overlay.command ?? command,
      ...(args.length > 0 ? { args } : {}),
      ...(Object.keys(env).length > 0 ? { env } : {}),
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    },
    diagnostics,
  };
}

function serverList(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new McpRegistryError(
      "MCP_REGISTRY_PARSE",
      "MCP registry response is not a JSON object with a servers array.",
    );
  }
  const raw = (data as { servers?: unknown }).servers;
  if (!Array.isArray(raw)) {
    throw new McpRegistryError(
      "MCP_REGISTRY_PARSE",
      "MCP registry response is missing a servers array.",
    );
  }
  const out: Record<string, unknown>[] = [];
  for (const item of raw) {
    const server = unwrapServerEntry(item);
    if (server) out.push(server);
  }
  return out;
}

function unwrapServerEntry(item: unknown): Record<string, unknown> | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const rec = item as Record<string, unknown>;
  const nested = rec.server;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const server = { ...(nested as Record<string, unknown>) };
    for (const [key, value] of Object.entries(rec)) {
      if (key !== "server" && !(key in server)) server[key] = value;
    }
    return typeof server.name === "string" ? server : null;
  }
  return typeof rec.name === "string" ? rec : null;
}

function unwrapSingleServer(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const rec = data as Record<string, unknown>;
  const nested = rec.server;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const server = { ...(nested as Record<string, unknown>) };
    for (const [key, value] of Object.entries(rec)) {
      if (key !== "server" && !(key in server)) server[key] = value;
    }
    return typeof server.name === "string" ? server : null;
  }
  return typeof rec.name === "string" ? rec : null;
}

function toSummary(server: Record<string, unknown>): McpRegistryServerSummary {
  const packages = asArray(server.packages).map((pkg) => toPackage(pkg));
  const remotes = asArray(server.remotes).map((remote) => toRemote(remote));
  const transports = new Set<string>();
  if (packages.length > 0) transports.add("stdio");
  for (const remote of remotes) transports.add(remote.type);
  return {
    name: String(server.name),
    description: typeof server.description === "string" ? server.description : null,
    version: serverVersion(server),
    transports: [...transports],
    packages: packages.map((pkg) => ({
      registryType: pkg.registryType,
      identifier: pkg.identifier,
      ...(pkg.version ? { version: pkg.version } : {}),
      ...(pkg.runtimeHint ? { runtimeHint: pkg.runtimeHint } : {}),
    })),
  };
}

function toDetails(server: Record<string, unknown>): McpRegistryServerDetails {
  const summary = toSummary(server);
  const repository = asRecord(server.repository);
  return {
    ...summary,
    repositoryUrl: stringOrNull(repository?.url) ?? stringOrNull(server.repositoryUrl),
    websiteUrl: stringOrNull(server.websiteUrl) ?? stringOrNull(server.website),
    remotes: asArray(server.remotes).map((remote) => toRemote(remote)),
    packageDetails: asArray(server.packages).map((pkg) => toPackage(pkg)),
  };
}

function toPackage(value: unknown): McpRegistryPackage {
  const rec = asRecord(value) ?? {};
  const registryType =
    stringOrNull(rec.registryType) ??
    stringOrNull(rec.registry_name) ??
    stringOrNull(rec.registryName) ??
    "";
  const identifier =
    stringOrNull(rec.identifier) ?? stringOrNull(rec.name) ?? stringOrNull(rec.package) ?? "";
  return {
    registryType:
      registryType || inferRegistryType({ identifier, runtimeHint: runtimeHint(rec) ?? undefined }),
    identifier,
    version: stringOrNull(rec.version) ?? undefined,
    runtimeHint: runtimeHint(rec) ?? undefined,
    runtimeArguments: argumentValues(rec.runtimeArguments ?? rec.runtime_arguments),
    packageArguments: argumentValues(rec.packageArguments ?? rec.package_arguments),
    environmentVariables: environmentVariables(
      rec.environmentVariables ?? rec.environment_variables,
    ),
  };
}

function toRemote(value: unknown): McpRegistryRemote {
  const rec = asRecord(value) ?? {};
  return {
    type: normalizeTransport(stringOrNull(rec.type) ?? stringOrNull(rec.transport_type)) ?? "http",
    url: stringOrNull(rec.url) ?? stringOrNull(rec.endpoint) ?? "",
    headers: headerEntries(rec.headers),
  };
}

function runtimeHint(rec: Record<string, unknown>): string | null {
  return stringOrNull(rec.runtimeHint) ?? stringOrNull(rec.runtime_hint);
}

function serverVersion(server: Record<string, unknown>): string | null {
  const direct = stringOrNull(server.version);
  if (direct) return direct;
  const detail = asRecord(server.version_detail) ?? asRecord(server.versionDetail);
  if (detail) {
    const nested = stringOrNull(detail.version);
    if (nested) return nested;
  }
  const pkg = asArray(server.packages)[0];
  const pkgVersion = asRecord(pkg)?.version;
  return typeof pkgVersion === "string" && pkgVersion.trim() ? pkgVersion : null;
}

function argumentValues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      if (entry.trim()) out.push(entry);
      continue;
    }
    const rec = asRecord(entry);
    if (!rec) continue;
    const required = rec.is_required ?? rec.isRequired ?? rec.required;
    if (required === false) continue;
    const raw = rec.value_hint ?? rec.valueHint ?? rec.value ?? rec.default ?? rec.defaultValue;
    if (typeof raw !== "string" || !raw.trim()) continue;
    const type = typeof rec.type === "string" ? rec.type.toLowerCase() : "";
    const name = typeof rec.name === "string" ? rec.name.trim() : "";
    if (type === "named" && name) {
      out.push(name.startsWith("-") ? name : `--${name}`, raw);
      continue;
    }
    out.push(raw);
  }
  return out;
}

function environmentVariables(value: unknown): McpRegistryEnvironmentVariable[] {
  if (!Array.isArray(value)) return [];
  const out: McpRegistryEnvironmentVariable[] = [];
  for (const entry of value) {
    const rec = asRecord(entry);
    if (!rec) continue;
    const name = stringOrNull(rec.name) ?? "";
    if (!name) continue;
    out.push({
      name,
      required: rec.isRequired === true || rec.is_required === true || rec.required === true,
      secret: rec.isSecret === true || rec.is_secret === true || rec.secret === true,
      ...(typeof rec.default === "string"
        ? { defaultValue: rec.default }
        : typeof rec.value === "string"
          ? { defaultValue: rec.value }
          : {}),
    });
  }
  return out;
}

function headerEntries(value: unknown): McpRegistryRemoteHeader[] {
  if (Array.isArray(value)) {
    const out: McpRegistryRemoteHeader[] = [];
    for (const entry of value) {
      const rec = asRecord(entry);
      if (!rec) continue;
      const name = stringOrNull(rec.name) ?? "";
      if (!name) continue;
      out.push({
        name,
        ...(typeof rec.value === "string" ? { value: rec.value } : {}),
      });
    }
    return out;
  }
  const rec = asRecord(value);
  if (!rec) return [];
  return Object.entries(rec)
    .filter(([name]) => name.length > 0)
    .map(([name, headerValue]) => ({
      name,
      ...(typeof headerValue === "string" ? { value: headerValue } : {}),
    }));
}

function envFromRegistry(pkg: McpRegistryPackage): Record<string, string> {
  const env: Record<string, string> = {};
  for (const variable of pkg.environmentVariables) {
    // Never copy a registry-declared secret default into a manifest/host config.
    if (!variable.secret && variable.defaultValue !== undefined) {
      env[variable.name] = variable.defaultValue;
    }
  }
  return env;
}

function headersFromRegistry(remote: McpRegistryRemote): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const header of remote.headers) {
    if (header.value !== undefined && header.value !== "") headers[header.name] = header.value;
  }
  return headers;
}

function mergeEnv(
  base: Record<string, string>,
  overlay: Record<string, string> | undefined,
): Record<string, string> {
  const merged = { ...base };
  for (const [key, value] of Object.entries(overlay ?? {})) {
    if (typeof value === "string") merged[key] = value;
  }
  return merged;
}

function mergeHeaders(
  base: Record<string, string>,
  overlay: Record<string, string> | undefined,
): Record<string, string> {
  const merged = { ...base };
  for (const [key, value] of Object.entries(overlay ?? {})) {
    if (typeof value === "string") merged[key] = value;
  }
  return merged;
}

function pickRemote(remotes: McpRegistryRemote[]): McpRegistryRemote | undefined {
  return remotes.find((remote) => remote.url.trim().length > 0);
}

function pickPackage(packages: McpRegistryPackage[]): McpRegistryPackage | undefined {
  const priority = ["npm", "docker", "oci", "pypi", "python", "homebrew", "brew"];
  for (const target of priority) {
    const found = packages.find((pkg) => normalizeRegistryType(pkg) === target);
    if (found) return found;
  }
  return packages[0];
}

function normalizeRegistryType(pkg: McpRegistryPackage): string {
  return (pkg.registryType || inferRegistryType(pkg)).toLowerCase();
}

function inferRegistryType(pkg: { identifier?: string; runtimeHint?: string }): string {
  const hint = (pkg.runtimeHint ?? "").toLowerCase();
  if (hint === "npx" || hint === "npm") return "npm";
  if (hint === "uvx" || hint === "pip" || hint === "pipx") return "pypi";
  if (hint === "docker") return "docker";
  if (hint === "brew") return "homebrew";
  const id = pkg.identifier ?? "";
  if (id.startsWith("@") && id.includes("/")) return "npm";
  if (id.startsWith("ghcr.io/") || id.startsWith("mcr.microsoft.com/")) return "docker";
  return "";
}

function normalizeTransport(value: string | null | undefined): string | null {
  const raw = value?.trim().toLowerCase();
  if (!raw) return null;
  if (raw === "streamable_http" || raw === "streamablehttp" || raw === "streamable-http") {
    return "streamable-http";
  }
  if (raw === "sse") return "sse";
  if (raw === "http" || raw === "remote") return "http";
  if (raw === "stdio" || raw === "local") return "stdio";
  return raw;
}

function normalizeApiPrefix(value: string | undefined): string {
  const trimmed = (value ?? "/v0").trim();
  if (!trimmed) return "/v0";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

function registrySourceHint(source: McpRegistrySource): string {
  switch (source) {
    case "explicit":
      return "Check the --registry value or the dependency's registry: URL.";
    case "env":
      return `Check ${MCP_REGISTRY_URL_ENV} (and set ${MCP_REGISTRY_ALLOW_HTTP_ENV}=1 for http://).`;
    case "config":
      return "Check `bapm config get mcp-registry-url`.";
    default:
      return "";
  }
}

function nonEmpty(value: string | undefined | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function envFlag(value: string | undefined): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}
