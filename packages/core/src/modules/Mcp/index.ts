/**
 * Mcp — collect MCP server definitions and apply lock `mcp_*` inventory.
 *
 * ## Public API
 *
 * - `collectMcpServers` — direct + optional transitive (trust-transitive / grant)
 * - `applyMcpInventoryToLock` — populate `mcp_servers` / related fields
 *
 * ## Example
 *
 * ```ts
 * import { collectMcpServers, applyMcpInventoryToLock } from "@/modules/Mcp";
 * const collected = collectMcpServers({ cwd, rootManifest, nodes, trustTransitiveMcp });
 * ```
 */

export type {
  CollectedMcpServer,
  CollectMcpServersOptions,
  CollectMcpServersResult,
  ApplyMcpInventoryOptions,
} from "./types.ts";

export { collectMcpServers } from "./collect.ts";
export { applyMcpInventoryToLock } from "./lockInventory.ts";
