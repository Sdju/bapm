import {
  listMcpInventory,
  searchMcpInventory,
  showMcpServer,
  type McpServerDetails,
  type McpServerSummary,
} from "@b-apm/core";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type McpCliDeps = LifecycleCliDeps;

export type McpOptions = { args?: string[]; cwd?: string };

export type McpSub = "list" | "show" | "search" | "install";

export type ParsedMcpArgs = {
  sub: McpSub;
  name?: string;
  query?: string;
  json: boolean;
  help?: boolean;
  error?: string;
};

const MCP_SUBS = new Set<McpSub>(["list", "show", "search", "install"]);

export function formatMcpHelp(deps: McpCliDeps): string {
  return `${deps.name} mcp — Inspect MCP servers from the manifest and lock (read-only)

Usage:
  bapm mcp list [--json]
  bapm mcp show <name> [--json]
  bapm mcp search <query> [--json]

Options:
  --json       Stable machine-readable output
  --help, -h   Show this help

Sources:
  - ${deps.manifestFile} dependencies.mcp (direct declarations)
  - the lock inventory: mcp_servers, mcp_configs, mcp_target_servers,
    mcp_config_provenance, and optional mcp_omissions

Notes:
  Read-only: no network, no registry lookup, and no config/lock writes.
  \`mcp search\` is an offline substring search over the local inventory.
  \`mcp install\` is not included; use \`bapm install\` to deploy MCP servers.
`;
}

export function parseMcpArgs(argv: string[]): ParsedMcpArgs {
  if (argv.length === 0) return { sub: "list", json: false };

  const [first, ...rest] = argv;
  if (first === "--help" || first === "-h") {
    return { sub: "list", json: false, help: true };
  }

  let sub: McpSub = "list";
  let tail = argv;
  if (first === "--json") {
    return parseFlags("list", rest, true);
  }
  if (first?.startsWith("-")) {
    return { sub: "list", json: false, error: `Unknown mcp flag: ${first}` };
  }
  if (!MCP_SUBS.has(first as McpSub)) {
    return { sub: "list", json: false, error: `Unknown mcp subcommand: ${first}` };
  }
  sub = first as McpSub;
  tail = rest;
  return parseFlags(sub, tail, false);
}

function parseFlags(sub: McpSub, argv: string[], initialJson: boolean): ParsedMcpArgs {
  let json = initialJson;
  const positionals: string[] = [];
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") return { sub, json, help: true };
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg.startsWith("-")) {
      return { sub, json, error: `Unknown mcp flag: ${arg}` };
    }
    positionals.push(arg);
  }

  if (sub === "list") {
    if (positionals.length > 0) {
      return { sub, json, error: `Unexpected mcp list argument: ${positionals[0]}` };
    }
    return { sub, json };
  }
  if (sub === "show") {
    if (positionals.length === 0) {
      return { sub, json, error: "mcp show requires a server name" };
    }
    if (positionals.length > 1) {
      return { sub, json, error: `Unexpected mcp show argument: ${positionals[1]}` };
    }
    return { sub, json, name: positionals[0] };
  }
  if (sub === "search") {
    if (positionals.length === 0) {
      return { sub, json, error: "mcp search requires a query" };
    }
    if (positionals.length > 1) {
      return { sub, json, error: `Unexpected mcp search argument: ${positionals[1]}` };
    }
    return { sub, json, query: positionals[0] };
  }
  return { sub, json };
}

function printTable(rows: McpServerSummary[]): void {
  const headers = ["NAME", "PACKAGE", "ORIGIN", "TRANSPORT", "TARGETS", "APPROVAL", "CONFIG"];
  const body = rows.map((row) => [
    row.name,
    row.package ?? "-",
    row.origin,
    row.transport ?? "-",
    row.targets.map((target) => target.targetId).join(",") || "-",
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

  if (parsed.sub === "install") {
    const message = "mcp install is not included; use `bapm install` to deploy MCP servers";
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }

  try {
    if (parsed.sub === "show") {
      const result = showMcpServer({
        cwd: options.cwd,
        name: parsed.name ?? "",
      });
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

    if (parsed.sub === "search") {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
}
