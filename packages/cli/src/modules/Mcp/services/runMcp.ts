import {
  createMcpRegistryClient,
  listMcpInventory,
  loadManifest,
  redactMcpRegistryDetails,
  resolveMcpRegistryUrl,
  resolveMcpServerFromRegistry,
  searchMcpInventory,
  serializeManifest,
  showMcpServer,
  writeProducerManifest,
  type McpRegistryClient,
  type McpRegistryServerDetails,
  type McpRegistryServerSummary,
  type McpRegistrySource,
  type McpRegistryTransport,
  type McpServerDetails,
  type McpServerSummary,
} from "@b-apm/core";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";
import { readConfiguredMcpRegistryUrl } from "@/modules/Config";
import { runMcpReconfigure } from "@/modules/Install";

export type McpCliDeps = LifecycleCliDeps & {
  /** Override user config root for `mcp-registry-url` precedence tests. */
  configDir?: string;
  configRoot?: string;
  /** Env overlay for registry precedence (defaults to `process.env`). */
  env?: Record<string, string | undefined>;
  /** Injectable HTTP port; production uses the shared cache/redirect transport. */
  mcpRegistryTransport?: McpRegistryTransport;
  /** Injectable client factory for CLI tests (no network). */
  mcpRegistryClientFactory?: (resolution: {
    url: string;
    source: McpRegistrySource;
  }) => McpRegistryClient;
  /** Injectable post-write configure pass (defaults to the existing MCP install). */
  configureAfterInstall?: (options: { cwd?: string }) => Promise<{ ok: boolean; message?: string }>;
};

export type McpOptions = { args?: string[]; cwd?: string };

export type McpSub = "list" | "show" | "search" | "install";

export type ParsedMcpArgs = {
  sub: McpSub;
  name?: string;
  query?: string;
  json: boolean;
  help?: boolean;
  error?: string;
  /** Registry endpoint override (`--registry`). */
  registry?: string;
  /** Offline inventory mode for `search` / `show`. */
  local: boolean;
  /** Optional registry version pin for `show` / `install`. */
  version?: string;
  /** Search result cap. */
  limit?: number;
  /** Preview only: emit the manifest snippet without writing/installing. */
  dryRun: boolean;
};

const MCP_SUBS = new Set<McpSub>(["list", "show", "search", "install"]);

export function formatMcpHelp(deps: McpCliDeps): string {
  return `${deps.name} mcp — Inspect and install MCP servers

Usage:
  bapm mcp list [--json]
  bapm mcp show <name> [--registry URL] [--version VER] [--json] [--local]
  bapm mcp search <query> [--registry URL] [--limit N] [--json] [--local]
  bapm mcp install <name> [--registry URL] [--version VER] [--dry-run] [--json]

Options:
  --json            Stable machine-readable output
  --registry URL    MCP registry base URL (overrides MCP_REGISTRY_URL/config)
  --local           Search/show only the local lock + manifest inventory
  --version VER     Registry server version (default: latest)
  --limit N         Maximum registry search results (default: 10)
  --dry-run         Print the would-be dependencies.mcp entry; no writes
  --help, -h        Show this help

Registry:
  Precedence: --registry > MCP_REGISTRY_URL > \`bapm config mcp-registry-url\`
  > ${"https://api.mcp.github.com"}. Plain http:// is accepted for an explicit
  --registry/config URL; the env var additionally requires MCP_REGISTRY_ALLOW_HTTP=1.
  Set MCP_REGISTRY_TOKEN for a private registry. Tokens are never printed.
  GET responses may use the shared BAPM_CACHE_DIR HTTP cache (BAPM_HTTP_CACHE=0
  disables it; authenticated requests bypass it).

Local inventory:
  list/search --local/show --local read ${deps.manifestFile} dependencies.mcp
  and the lock bags: mcp_servers, mcp_configs, mcp_target_servers,
  mcp_config_provenance, and optional mcp_omissions.

Install:
  \`mcp install\` resolves the registry server, appends a concrete
  dependencies.mcp entry with registry: false, then runs the existing MCP
  configure pass. \`--dry-run\` only prints the manifest entry.
`;
}

export function parseMcpArgs(argv: string[]): ParsedMcpArgs {
  if (argv.length === 0) return baseParsed("list");

  const [first, ...rest] = argv;
  if (first === "--help" || first === "-h") {
    return { ...baseParsed("list"), help: true };
  }

  let sub: McpSub = "list";
  let tail = argv;
  if (first === "--json") {
    return parseFlags("list", rest, true);
  }
  if (first?.startsWith("-")) {
    return { ...baseParsed("list"), error: `Unknown mcp flag: ${first}` };
  }
  if (!MCP_SUBS.has(first as McpSub)) {
    return { ...baseParsed("list"), error: `Unknown mcp subcommand: ${first}` };
  }
  sub = first as McpSub;
  tail = rest;
  return parseFlags(sub, tail, false);
}

function baseParsed(sub: McpSub): ParsedMcpArgs {
  return { sub, json: false, local: false, dryRun: false };
}

function parseFlags(sub: McpSub, argv: string[], initialJson: boolean): ParsedMcpArgs {
  let json = initialJson;
  let local = false;
  let dryRun = false;
  let registry: string | undefined;
  let version: string | undefined;
  let limit: number | undefined;
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") return { ...baseParsed(sub), json, help: true };
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--local") {
      if (sub !== "search" && sub !== "show") {
        return { ...baseParsed(sub), json, error: `Unknown ${sub} flag: --local` };
      }
      local = true;
      continue;
    }
    if (arg === "--dry-run") {
      if (sub !== "install") {
        return { ...baseParsed(sub), json, error: `Unknown ${sub} flag: --dry-run` };
      }
      dryRun = true;
      continue;
    }
    if (arg === "--registry" || arg.startsWith("--registry=")) {
      if (sub === "list") {
        return { ...baseParsed(sub), json, error: "Unknown list flag: --registry" };
      }
      const value = arg === "--registry" ? argv[i + 1] : arg.slice("--registry=".length);
      if (!value || (arg === "--registry" && value.startsWith("-"))) {
        return { ...baseParsed(sub), json, error: "Missing value for --registry URL" };
      }
      registry = value;
      if (arg === "--registry") i += 1;
      continue;
    }
    if (arg === "--version" || arg.startsWith("--version=")) {
      if (sub !== "show" && sub !== "install") {
        return { ...baseParsed(sub), json, error: `Unknown ${sub} flag: --version` };
      }
      const value = arg === "--version" ? argv[i + 1] : arg.slice("--version=".length);
      if (!value || (arg === "--version" && value.startsWith("-"))) {
        return { ...baseParsed(sub), json, error: "Missing value for --version VER" };
      }
      version = value;
      if (arg === "--version") i += 1;
      continue;
    }
    if (arg === "--limit" || arg.startsWith("--limit=")) {
      if (sub !== "search") {
        return { ...baseParsed(sub), json, error: `Unknown ${sub} flag: --limit` };
      }
      const value = arg === "--limit" ? argv[i + 1] : arg.slice("--limit=".length);
      const parsed = Number(value);
      if (!value || !Number.isInteger(parsed) || parsed <= 0) {
        return { ...baseParsed(sub), json, error: "Invalid --limit; expected a positive integer" };
      }
      limit = parsed;
      if (arg === "--limit") i += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      return { ...baseParsed(sub), json, error: `Unknown mcp flag: ${arg}` };
    }
    positionals.push(arg);
  }

  const result = { ...baseParsed(sub), json, registry, version, limit, local, dryRun };
  if (local && registry !== undefined) {
    return { ...result, error: "--local and --registry cannot be combined" };
  }

  if (sub === "list") {
    if (positionals.length > 0) {
      return { ...result, error: `Unexpected mcp list argument: ${positionals[0]}` };
    }
    return result;
  }
  if (sub === "show") {
    if (positionals.length === 0) {
      return { ...result, error: "mcp show requires a server name" };
    }
    if (positionals.length > 1) {
      return { ...result, error: `Unexpected mcp show argument: ${positionals[1]}` };
    }
    return { ...result, name: positionals[0] };
  }
  if (sub === "search") {
    if (positionals.length === 0) {
      return { ...result, error: "mcp search requires a query" };
    }
    if (positionals.length > 1) {
      return { ...result, error: `Unexpected mcp search argument: ${positionals[1]}` };
    }
    return { ...result, query: positionals[0] };
  }
  if (positionals.length === 0) {
    return { ...result, error: "mcp install requires a server name" };
  }
  if (positionals.length > 1) {
    return { ...result, error: `Unexpected mcp install argument: ${positionals[1]}` };
  }
  return { ...result, name: positionals[0] };
}

function printTable(rows: McpServerSummary[]): void {
  const headers = ["NAME", "PACKAGE", "ORIGIN", "TRANSPORT", "TARGETS", "APPROVAL", "CONFIG"];
  const body = rows.map((row) => [
    row.name,
    row.package ?? "-",
    row.origin,
    row.transport ?? "-",
    row.targets.map((target: { targetId: string }) => target.targetId).join(",") || "-",
    row.omitted ? "omitted" : (row.approval ?? "-"),
    row.configPath ?? "-",
  ]);
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...body.map((cells) => cells[index]!.length)),
  );
  const render = (cells: string[]) =>
    cells
      .map((cell, index) => cell.padEnd(widths[index]!))
      .join("  ")
      .trimEnd();
  console.log(render(headers));
  console.log(render(widths.map((width) => "-".repeat(width))));
  for (const cells of body) console.log(render(cells));
}

function printServer(server: McpServerDetails): void {
  console.log(`name:        ${server.name}`);
  console.log(`package:     ${server.package ?? "-"}`);
  console.log(`origin:      ${server.origin}`);
  console.log(`transport:   ${server.transport ?? "-"}`);
  console.log(`command:     ${server.command ?? "-"}`);
  console.log(`args:        ${server.args ? server.args.join(" ") : "-"}`);
  console.log(`url:         ${server.url ?? "-"}`);
  console.log(`env:         ${server.env ? Object.keys(server.env).join(", ") : "-"}`);
  console.log(`headers:     ${server.headers ? Object.keys(server.headers).join(", ") : "-"}`);
  console.log(`config path: ${server.configPath ?? "-"}`);
  console.log(`approval:    ${server.approval ?? "-"}`);
  console.log(`withheld:    ${server.withheld ? "yes" : "no"}`);
  console.log(`omitted:     ${server.omitted ? "yes" : "no"}`);
  console.log(`source:      ${server.source}`);
  console.log(`lockfile:    ${server.lockPath ?? "-"}`);
  console.log(`manifest:    ${server.manifestPath ?? "-"}`);
  if (server.targets.length === 0) {
    console.log("targets:     -");
  } else {
    console.log("targets:");
    for (const target of server.targets) {
      console.log(`  ${target.targetId.padEnd(14)} ${target.path ?? "-"}`);
    }
  }
  if (server.declaration) {
    console.log("\ndeclaration:");
    console.log(JSON.stringify(server.declaration, null, 2));
  }
  if (server.lockEntry) {
    console.log("\nlock entry:");
    console.log(JSON.stringify(server.lockEntry, null, 2));
  }
}

function printRegistryTable(rows: McpRegistryServerSummary[]): void {
  const headers = ["NAME", "VERSION", "TRANSPORTS", "PACKAGES", "DESCRIPTION"];
  const body = rows.map((row) => [
    row.name,
    row.version ?? "-",
    row.transports.join(",") || "-",
    row.packages
      .map((pkg: McpRegistryServerSummary["packages"][number]) => pkg.identifier)
      .join(",") || "-",
    row.description ?? "-",
  ]);
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...body.map((cells) => cells[index]!.length)),
  );
  const render = (cells: string[]) =>
    cells
      .map((cell, index) => cell.padEnd(widths[index]!))
      .join("  ")
      .trimEnd();
  console.log(render(headers));
  console.log(render(widths.map((width) => "-".repeat(width))));
  for (const cells of body) console.log(render(cells));
}

function printRegistryServer(details: McpRegistryServerDetails): void {
  const safe = redactMcpRegistryDetails(details);
  console.log(`name:        ${safe.name}`);
  console.log(`description: ${safe.description ?? "-"}`);
  console.log(`version:     ${safe.version ?? "-"}`);
  console.log(`repository:  ${safe.repositoryUrl ?? "-"}`);
  console.log(`website:     ${safe.websiteUrl ?? "-"}`);
  console.log(`transports:  ${safe.transports.join(", ") || "-"}`);
  if (safe.packages.length === 0) {
    console.log("packages:    -");
  } else {
    console.log("packages:");
    for (const pkg of safe.packages) {
      console.log(
        `  ${pkg.registryType || "?"}: ${pkg.identifier}${pkg.version ? `@${pkg.version}` : ""}${pkg.runtimeHint ? ` (${pkg.runtimeHint})` : ""}`,
      );
    }
  }
  if (safe.remotes.length === 0) {
    console.log("remotes:     -");
  } else {
    console.log("remotes:");
    for (const remote of safe.remotes) {
      console.log(
        `  ${remote.type}: ${remote.url}${remote.headers.length > 0 ? ` [headers: ${remote.headers.join(", ")}]` : ""}`,
      );
    }
  }
}

export async function runMcpCli(
  deps: McpCliDeps,
  options: McpOptions = {},
): Promise<LifecycleResult> {
  const parsed = parseMcpArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatMcpHelp(deps));
    return { ok: true, exitCode: 0 };
  }
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, exitCode: 1, message: parsed.error };
  }

  try {
    if (parsed.sub === "list") return runLocalList(deps, options, parsed);
    if (parsed.sub === "search" && parsed.local) return runLocalSearch(deps, options, parsed);
    if (parsed.sub === "show" && parsed.local) return runLocalShow(deps, options, parsed);

    if (parsed.sub === "search") return await runRegistrySearch(deps, parsed);
    if (parsed.sub === "show") return await runRegistryShow(deps, parsed);
    return await runRegistryInstall(deps, options, parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (parsed.json) {
      console.error(
        JSON.stringify(
          {
            error: registryErrorCode(error),
            message,
          },
          null,
          2,
        ),
      );
    } else {
      console.error(`${deps.name}: ${message}`);
    }
    return { ok: false, exitCode: 1, message };
  }
}

function runLocalList(
  deps: McpCliDeps,
  options: McpOptions,
  parsed: ParsedMcpArgs,
): LifecycleResult {
  const result = listMcpInventory({ cwd: options.cwd });
  if (parsed.json) {
    console.log(
      JSON.stringify(
        {
          lockfile: result.lockPath,
          manifest: result.manifestPath,
          servers: result.servers,
        },
        null,
        2,
      ),
    );
  } else if (result.servers.length === 0) {
    console.log("(no MCP servers)");
  } else {
    printTable(result.servers);
  }
  return { ok: true, exitCode: 0 };
}

function runLocalSearch(
  deps: McpCliDeps,
  options: McpOptions,
  parsed: ParsedMcpArgs,
): LifecycleResult {
  const result = searchMcpInventory({
    cwd: options.cwd,
    query: parsed.query ?? "",
  });
  if (parsed.json) {
    console.log(
      JSON.stringify(
        {
          query: result.query,
          lockfile: result.lockPath,
          manifest: result.manifestPath,
          servers: result.servers,
        },
        null,
        2,
      ),
    );
  } else if (result.servers.length === 0) {
    console.log(`(no MCP servers matching "${result.query}")`);
  } else {
    printTable(result.servers);
  }
  return { ok: true, exitCode: 0 };
}

function runLocalShow(
  deps: McpCliDeps,
  options: McpOptions,
  parsed: ParsedMcpArgs,
): LifecycleResult {
  const result = showMcpServer({ cwd: options.cwd, name: parsed.name ?? "" });
  if (!result.ok) {
    if (parsed.json) {
      console.error(
        JSON.stringify(
          {
            error: "unknown_server",
            name: result.name,
            available: result.available,
          },
          null,
          2,
        ),
      );
    } else {
      console.error(`${deps.name}: ${result.error}`);
      if (result.available.length > 0) {
        console.error(`Available: ${result.available.join(", ")}`);
      }
    }
    return { ok: false, exitCode: 1, message: result.error };
  }
  if (parsed.json) {
    console.log(JSON.stringify(result.server, null, 2));
  } else {
    printServer(result.server);
  }
  return { ok: true, exitCode: 0 };
}

async function runRegistrySearch(
  deps: McpCliDeps,
  parsed: ParsedMcpArgs,
): Promise<LifecycleResult> {
  const registry = await makeRegistry(deps, parsed);
  const servers = await registry.client.searchServers(parsed.query ?? "", {
    limit: parsed.limit ?? 10,
  });
  if (parsed.json) {
    console.log(
      JSON.stringify(
        {
          registry: registry.url,
          source: registry.source,
          query: parsed.query,
          servers,
        },
        null,
        2,
      ),
    );
  } else if (servers.length === 0) {
    console.log(`(no MCP servers matching "${parsed.query}")`);
  } else {
    printRegistryTable(servers);
  }
  return { ok: true, exitCode: 0 };
}

async function runRegistryShow(deps: McpCliDeps, parsed: ParsedMcpArgs): Promise<LifecycleResult> {
  const registry = await makeRegistry(deps, parsed);
  const details = await registry.client.getServer(parsed.name ?? "", {
    version: parsed.version,
  });
  if (parsed.json) {
    console.log(
      JSON.stringify(
        {
          registry: registry.url,
          source: registry.source,
          server: redactMcpRegistryDetails(details),
        },
        null,
        2,
      ),
    );
  } else {
    printRegistryServer(details);
  }
  return { ok: true, exitCode: 0 };
}

async function runRegistryInstall(
  deps: McpCliDeps,
  options: McpOptions,
  parsed: ParsedMcpArgs,
): Promise<LifecycleResult> {
  const registry = await makeRegistry(deps, parsed);
  const cwd = options.cwd ?? process.cwd();
  const details = await registry.client.getServer(parsed.name ?? "", {
    version: parsed.version,
  });
  const resolution = resolveMcpServerFromRegistry(details);
  for (const diagnostic of resolution.diagnostics) {
    if (diagnostic.warn) console.error(`${deps.name}: warning: ${diagnostic.message}`);
  }
  const entry = { ...resolution.server };
  const snippet = serializeManifest({ dependencies: { mcp: [entry] } });

  if (parsed.dryRun) {
    if (parsed.json) {
      console.log(
        JSON.stringify(
          {
            registry: registry.url,
            source: registry.source,
            server: redactMcpRegistryDetails(details),
            manifest: entry,
            dryRun: true,
          },
          null,
          2,
        ),
      );
    } else {
      console.log(`# ${deps.name} mcp install ${entry.name} --dry-run`);
      console.log(`# registry: ${registry.url}`);
      console.log(snippet.trimEnd());
    }
    return { ok: true, exitCode: 0 };
  }

  const loaded = loadManifest({ cwd });
  const dependencies = { ...loaded.document.dependencies };
  const existing = Array.isArray(dependencies.mcp) ? [...dependencies.mcp] : [];
  if (existing.some((item) => nameOfMcpDeclaration(item) === entry.name)) {
    const message = `MCP server "${entry.name}" is already declared in ${loaded.sourceFilename}; edit that entry or remove it first`;
    if (parsed.json) {
      console.error(JSON.stringify({ error: "already_declared", message }, null, 2));
    } else {
      console.error(`${deps.name}: ${message}`);
    }
    return { ok: false, exitCode: 1, message };
  }
  existing.push(entry);
  dependencies.mcp = existing;
  const document = { ...loaded.document, dependencies };
  writeProducerManifest(document, {
    cwd,
    sourcePath: loaded.sourcePath,
    sourceFilename: loaded.sourceFilename,
  });

  if (!parsed.json) {
    console.log(`${deps.name}: added ${entry.name} to ${loaded.sourceFilename}`);
    console.log(snippet.trimEnd());
  }

  const configure = deps.configureAfterInstall ?? runMcpReconfigure;
  const configured = await configure({ cwd });
  if (!configured.ok) {
    const message = configured.message ?? "MCP configure failed";
    if (parsed.json) {
      console.error(
        JSON.stringify(
          {
            registry: registry.url,
            source: registry.source,
            manifest: entry,
            added: true,
            installed: false,
            error: "install_failed",
            message,
          },
          null,
          2,
        ),
      );
    } else {
      console.error(`${deps.name}: ${message}`);
      console.error(`${deps.name}: entry was added; run \`${deps.name} install\` to retry`);
    }
    return { ok: false, exitCode: 1, message };
  }

  if (parsed.json) {
    console.log(
      JSON.stringify(
        {
          registry: registry.url,
          source: registry.source,
          server: redactMcpRegistryDetails(details),
          manifest: entry,
          added: true,
          installed: true,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`${deps.name}: installed MCP server ${entry.name}`);
  }
  return { ok: true, exitCode: 0 };
}

async function makeRegistry(
  deps: McpCliDeps,
  parsed: ParsedMcpArgs,
): Promise<{ client: McpRegistryClient; url: string; source: McpRegistrySource }> {
  const env = deps.env ?? (process.env as Record<string, string | undefined>);
  const resolved = resolveMcpRegistryUrl({
    explicit: parsed.registry,
    configuredUrl: readConfiguredMcpRegistryUrl({
      ...(deps.configDir !== undefined ? { configDir: deps.configDir } : {}),
      ...(deps.configRoot !== undefined ? { configRoot: deps.configRoot } : {}),
    }),
    env,
    allowHttp: parsed.registry !== undefined,
  });
  if (deps.mcpRegistryClientFactory) {
    return {
      client: deps.mcpRegistryClientFactory(resolved),
      url: resolved.url,
      source: resolved.source,
    };
  }
  return {
    client: createMcpRegistryClient({
      baseUrl: resolved.url,
      ...(deps.mcpRegistryTransport !== undefined ? { transport: deps.mcpRegistryTransport } : {}),
      env,
    }),
    url: resolved.url,
    source: resolved.source,
  };
}

function nameOfMcpDeclaration(item: unknown): string | undefined {
  if (!item || typeof item !== "object" || Array.isArray(item)) return undefined;
  const name = (item as Record<string, unknown>).name;
  return typeof name === "string" ? name : undefined;
}

function registryErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return "registry_error";
}
