export const AGENT_PLUGIN_MANIFEST_SCHEMA_V1 =
  "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";

export type AgentPluginAuthor = {
  name?: string;
  email?: string;
  url?: string;
};

/** Schema-compatible portable Agent Plugins v1 manifest. */
export type AgentPluginManifest = {
  $schema: typeof AGENT_PLUGIN_MANIFEST_SCHEMA_V1;
  name: string;
  version?: string;
  description?: string;
  author?: AgentPluginAuthor;
  homepage?: string;
  repository?: string;
  license?: string;
  keywords?: string[];
  /** Declared command file paths relative to the plugin root. */
  commands?: string[];
  /** Declared hook JSON paths relative to the plugin root. */
  hooks?: string[];
  extensions?: Record<string, Record<string, unknown>>;
};

export type AgentPluginDiagnostic = {
  code: string;
  message: string;
  path?: string;
  severity: "warning" | "error";
};

export type LoadAgentPluginManifestOptions = {
  /** Absolute or relative plugin package root. */
  root: string;
};

/** Input accepted by the portable v1 producer. */
export type CreateAgentPluginManifestOptions = {
  name: string;
  version?: string;
  description?: string;
  author?: AgentPluginAuthor;
  homepage?: string;
  repository?: string;
  license?: string;
  keywords?: string[];
  extensions?: Record<string, Record<string, unknown>>;
};

export type WriteAgentPluginManifestOptions = CreateAgentPluginManifestOptions & {
  /** Plugin package root. Created by the writer when absent. */
  root?: string;
  /** Explicit output path. Must be `<root>/plugin.json` when root is supplied. */
  path?: string;
};

export type WrittenAgentPluginManifest = {
  root: string;
  manifestPath: string;
  manifest: AgentPluginManifest;
};

export type LoadedAgentPluginManifest = {
  root: string;
  manifestPath: string;
  manifest: AgentPluginManifest;
  diagnostics: AgentPluginDiagnostic[];
};

export type AgentPluginSkill = {
  /** Immediate directory name below `skills/`. */
  name: string;
  /** Realpath of the complete skill directory, safe to import as a directory. */
  directory: string;
  skillPath: string;
};

export type DiscoverAgentPluginSkillsOptions = LoadAgentPluginManifestOptions & {
  packageName?: string;
};

export type DiscoverAgentPluginSkillsResult = LoadedAgentPluginManifest & {
  skills: AgentPluginSkill[];
};

/** Declared command or hook file under a portable plugin root. */
export type AgentPluginDeclaredPath = {
  /** Primitive name derived from the file stem. */
  name: string;
  type: "command" | "hook";
  /** Realpath of the declared file within the plugin root. */
  path: string;
  /** Original declared relative path from plugin.json. */
  declaredPath: string;
};

export type DiscoverAgentPluginDeclaredPathsResult = LoadedAgentPluginManifest & {
  commands: AgentPluginDeclaredPath[];
  hooks: AgentPluginDeclaredPath[];
};

export type AgentPluginMcpServer = {
  name: string;
  transport: "stdio" | "streamable-http" | "sse";
  command?: string;
  args?: string[];
  url?: string;
  cwd?: string;
  env?: Record<string, string>;
  /** Signals to targets that this must be adapted, rather than passed through. */
  format: "agent-plugin";
};

export type DiscoverAgentPluginMcpOptions = LoadAgentPluginManifestOptions & {
  /**
   * Directory owned by bapm for this installed plugin. It is never taken from
   * package configuration and is the only expansion target for PLUGIN_DATA.
   */
  dataRoot: string;
};

export type DiscoverAgentPluginMcpResult = LoadedAgentPluginManifest & {
  servers: AgentPluginMcpServer[];
};
