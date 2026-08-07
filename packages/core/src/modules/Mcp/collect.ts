import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadManifest, type BapmManifest } from "@/modules/Manifest";
import { discoverAgentPluginMcp } from "@/modules/AgentPlugins";
import type {
  CollectedMcpServer,
  CollectMcpServersOptions,
  CollectMcpServersResult,
} from "./types.ts";

type ParsedMcpEntry = {
  name: string;
  transport?: string;
  type?: string;
  command?: string;
  args?: unknown[];
  url?: string;
  env?: Record<string, string>;
  registry?: unknown;
};

/**
 * Collect MCP server definitions for deploy.
 * - Direct `dependencies.mcp` always included.
 * - Dependency MCP included when `--trust-transitive-mcp` OR grant surface is present
 *   (caller still runs sc-009 withhold for unapproved packages).
 */
export function collectMcpServers(options: CollectMcpServersOptions): CollectMcpServersResult {
  const root = options.rootManifest;
  const rootName = String(root.name ?? "root");
  const servers: CollectedMcpServer[] = [];
  const dependencyPackages = new Set<string>();
  const diagnostics: unknown[] = [];

  for (const entry of parseMcpList(root.dependencies?.mcp)) {
    servers.push(toCollected(entry, "direct", rootName));
  }

  const includeDeps = options.trustTransitiveMcp === true || options.grantSurface?.present === true;

  if (options.nodes) {
    for (const node of options.nodes) {
      if (!node.packageRoot || !existsSync(node.packageRoot)) continue;
      // Skip depth-0 / self if ever present
      if (node.depth !== undefined && node.depth < 1) continue;
      // A direct portable plugin is the explicit user-selected artifact. Its
      // root mcp.json follows direct-MCP semantics; deeper portable plugins
      // retain the normal transitive trust gate.
      const directPortable = node.artifactFormat === "agent-plugin" && node.depth === 1;
      if (!includeDeps && !directPortable) continue;
      if (node.artifactFormat === "agent-plugin") {
        try {
          const portable = discoverAgentPluginMcp({
            root: node.packageRoot,
            dataRoot: join(
              resolve(options.cwd ?? process.cwd()),
              ".bapm",
              "plugin-data",
              safeDataName(node.name),
            ),
          });
          diagnostics.push(...portable.diagnostics);
          if (portable.servers.length > 0) dependencyPackages.add(node.name);
          for (const server of portable.servers) {
            servers.push({ ...server, origin: "dependency", packageName: node.name });
          }
        } catch {
          diagnostics.push({
            code: "AGENT_PLUGIN_MCP_INVALID",
            message: `Ignoring invalid portable MCP root for "${node.name}"`,
            packageName: node.name,
          });
        }
        continue;
      }
      let depManifest: BapmManifest;
      try {
        depManifest = loadManifest({ cwd: resolve(node.packageRoot) }).document;
      } catch {
        continue;
      }
      const mcpList = parseMcpList(depManifest.dependencies?.mcp);
      if (mcpList.length === 0) continue;
      dependencyPackages.add(node.name);
      for (const entry of mcpList) {
        servers.push(toCollected(entry, "dependency", node.name));
      }
    }
  }

  return { servers, dependencyPackages: [...dependencyPackages], diagnostics };
}

function safeDataName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function toCollected(
  entry: ParsedMcpEntry,
  origin: "direct" | "dependency",
  packageName: string,
): CollectedMcpServer {
  return {
    name: entry.name,
    transport: entry.transport,
    type: entry.type,
    command: entry.command,
    args: entry.args,
    url: entry.url,
    env: entry.env,
    registry: entry.registry,
    origin,
    packageName,
  };
}

function parseMcpList(raw: unknown): ParsedMcpEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: ParsedMcpEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === "string" ? rec.name.trim() : "";
    if (!name) continue;
    out.push({
      name,
      transport: typeof rec.transport === "string" ? rec.transport : undefined,
      type: typeof rec.type === "string" ? rec.type : undefined,
      command: typeof rec.command === "string" ? rec.command : undefined,
      args: Array.isArray(rec.args) ? rec.args : undefined,
      url: typeof rec.url === "string" ? rec.url : undefined,
      env:
        rec.env && typeof rec.env === "object" && !Array.isArray(rec.env)
          ? (rec.env as Record<string, string>)
          : undefined,
      registry: rec.registry,
    });
  }
  return out;
}
