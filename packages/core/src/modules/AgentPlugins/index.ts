/**
 * Agent Plugins v1 consumer foundation.
 *
 * Validates only the portable root `plugin.json` and discovers portable skill
 * directories, declared commands/hooks paths, and root-scoped `mcp.json`, and
 * writes canonical portable roots.
 */
export type {
  AgentPluginAuthor,
  AgentPluginDeclaredPath,
  AgentPluginDiagnostic,
  AgentPluginManifest,
  AgentPluginMcpServer,
  AgentPluginSkill,
  CreateAgentPluginManifestOptions,
  DiscoverAgentPluginDeclaredPathsResult,
  DiscoverAgentPluginMcpOptions,
  DiscoverAgentPluginMcpResult,
  DiscoverAgentPluginSkillsOptions,
  DiscoverAgentPluginSkillsResult,
  LoadedAgentPluginManifest,
  LoadAgentPluginManifestOptions,
  WrittenAgentPluginManifest,
  WriteAgentPluginManifestOptions,
} from "./types.ts";
export { AGENT_PLUGIN_MANIFEST_SCHEMA_V1 } from "./types.ts";
export type { AgentPluginsErrorCode } from "./errors.ts";
export { AgentPluginsError } from "./errors.ts";
export { loadAgentPluginManifest, validateAgentPluginManifest } from "./load.ts";
export { discoverAgentPluginSkills } from "./discover.ts";
export { discoverAgentPluginDeclaredPaths } from "./declaredPaths.ts";
export { discoverAgentPluginMcp } from "./mcp.ts";
export {
  createAgentPluginManifest,
  serializeAgentPluginManifest,
  writeAgentPluginManifest,
} from "./write.ts";
