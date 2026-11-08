/**
 * Mcp — collect MCP server definitions, bake env placeholders, apply lock inventory.
 *
 * ## Public API
 *
 * - `collectMcpServers` — direct + optional transitive (trust-transitive / grant)
 * - `bakeMcpStringMap` / `bakeMcpServerMaps` — per-host placeholder bake / translate for MCP env and headers
 * - `applyMcpInventoryToLock` — populate `mcp_servers` / related fields (target optional)
 * - `scrubMcpInventory` — prune stale root-owned MCP inventory / clear all MCP bags
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
  ScrubMcpInventoryOptions,
} from "./types.ts";

export type {
  BakeMcpStringMapOptions,
  BakeMcpServerMapsOptions,
  BakeableMcpServer,
} from "./bake.ts";
export {
  bakeMcpStringMap,
  bakeMcpStringValue,
  bakeMcpServerMaps,
  McpEnvBakeError,
} from "./bake.ts";

export { collectMcpServers } from "./collect.ts";
export { applyMcpInventoryToLock, scrubMcpInventory } from "./lockInventory.ts";
