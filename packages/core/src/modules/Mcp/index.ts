/**
 * Mcp — collect MCP server definitions, bake env placeholders, apply lock inventory.
 *
 * ## Public API
 *
 * - `collectMcpServers` — direct + optional transitive (trust-transitive / grant)
 * - `bakeMcpStringMap` / `bakeMcpServerMaps` — install-time placeholder bake for Cursor
 * - `applyMcpInventoryToLock` — populate `mcp_servers` / related fields
 *
 * ## Example
 *
 * ```ts
 * import { collectMcpServers, applyMcpInventoryToLock, bakeMcpStringMap } from "@/modules/Mcp";
 * const collected = collectMcpServers({ cwd, rootManifest, nodes, trustTransitiveMcp });
 * ```
 */

export type {
  CollectedMcpServer,
  CollectMcpServersOptions,
  CollectMcpServersResult,
  ApplyMcpInventoryOptions,
} from "./types.ts";

export type { BakeMcpStringMapOptions, BakeableMcpServer } from "./bake.ts";
export {
  bakeMcpStringMap,
  bakeMcpStringValue,
  bakeMcpServerMaps,
  McpEnvBakeError,
} from "./bake.ts";

export { collectMcpServers } from "./collect.ts";
export { applyMcpInventoryToLock } from "./lockInventory.ts";
