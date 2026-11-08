/**
 * Mcp — collect MCP server definitions, bake env placeholders, apply lock inventory.
 *
 * ## Public API
 *
 * - `collectMcpServers` — direct + optional transitive (trust-transitive / grant)
 * - `bakeMcpStringMap` / `bakeMcpServerMaps` — per-host placeholder bake / translate for MCP env and headers
 * - `applyMcpInventoryToLock` — populate `mcp_servers` / related fields (target optional)
 * - `scrubMcpInventory` — prune stale root-owned MCP inventory / clear all MCP bags
 * - `listMcpInventory` / `showMcpServer` / `searchMcpInventory` — read-only inspect
 *   from the lock inventory + direct `dependencies.mcp`
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

export type {
  McpApprovalState,
  McpInventoryOptions,
  McpInventoryResult,
  McpInventoryTarget,
  McpSearchResult,
  McpServerDetails,
  McpServerSummary,
  McpShowResult,
} from "./inventory.ts";
export { listMcpInventory, searchMcpInventory, showMcpServer } from "./inventory.ts";
export type { ParsedMcpDeclaration } from "./parse.ts";
export { parseMcpDeclarations } from "./parse.ts";

export type {
  CreateMcpRegistryClientOptions,
  McpRegistryClient,
  McpRegistryDeclOverlay,
  McpRegistryEnv,
  McpRegistryEnvironmentVariable,
  McpRegistryErrorCode,
  McpRegistryGetServerOptions,
  McpRegistryLookup,
  McpRegistryPackage,
  McpRegistryRemote,
  McpRegistryRemoteHeader,
  McpRegistrySearchOptions,
  McpRegistryServerDetails,
  McpRegistryServerResolution,
  McpRegistryServerSummary,
  McpRegistrySource,
  McpRegistryTransport,
  ResolvedMcpRegistryUrl,
  ResolveMcpRegistryUrlOptions,
} from "./registry.ts";
export {
  BAPM_MCP_REGISTRY_TOKEN_ENV,
  DEFAULT_MCP_REGISTRY_URL,
  MCP_REGISTRY_ALLOW_HTTP_ENV,
  MCP_REGISTRY_TOKEN_ENV,
  MCP_REGISTRY_URL_ENV,
  McpRegistryError,
  createMcpRegistryClient,
  normalizeMcpRegistryUrl,
  redactMcpRegistryDetails,
  redactMcpRegistryUrl,
  resolveMcpRegistryUrl,
  resolveMcpServerFromRegistry,
} from "./registry.ts";
