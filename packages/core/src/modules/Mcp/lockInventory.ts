import type { LockfileDocument } from "@/modules/Lockfile";
import type { ApplyMcpInventoryOptions } from "./types.ts";

/**
 * Populate lock top-level `mcp_*` fields from configured servers.
 * Preserves unknown / `x-*` keys already on the document.
 */
export function applyMcpInventoryToLock(options: ApplyMcpInventoryOptions): LockfileDocument {
  const doc = options.document as LockfileDocument & Record<string, unknown>;
  const servers = options.servers;
  const names = servers.map((s) => s.name).filter(Boolean);

  const mcpServers: Record<string, Record<string, unknown>> = {};
  for (const s of servers) {
    if (!s.name) continue;
    mcpServers[s.name] = {
      name: s.name,
      package: s.packageName,
      ...Object.fromEntries(
        Object.entries(s).filter(([k]) => k !== "name" && k !== "packageName" && k !== "origin"),
      ),
    };
  }

  doc.mcp_servers = mcpServers;
  doc.mcp_configs = {
    ...(typeof doc.mcp_configs === "object" && doc.mcp_configs && !Array.isArray(doc.mcp_configs)
      ? (doc.mcp_configs as Record<string, unknown>)
      : {}),
    cursor: {
      path: options.configPath ?? ".cursor/mcp.json",
      // Fresh array — shared refs cause YAML anchors rejected by safe-subset load.
      servers: [...names],
    },
  };

  if (options.targetId) {
    const prev =
      typeof doc.mcp_target_servers === "object" &&
      doc.mcp_target_servers &&
      !Array.isArray(doc.mcp_target_servers)
        ? (doc.mcp_target_servers as Record<string, unknown>)
        : {};
    doc.mcp_target_servers = {
      ...prev,
      [options.targetId]: [...names],
    };
  }

  const provenance: Record<string, unknown> = {
    ...(typeof doc.mcp_config_provenance === "object" &&
    doc.mcp_config_provenance &&
    !Array.isArray(doc.mcp_config_provenance)
      ? (doc.mcp_config_provenance as Record<string, unknown>)
      : {}),
  };
  for (const s of servers) {
    if (!s.name) continue;
    provenance[s.name] = {
      package: s.packageName,
      path: options.configPath ?? ".cursor/mcp.json",
    };
  }
  doc.mcp_config_provenance = provenance;

  return doc;
}
