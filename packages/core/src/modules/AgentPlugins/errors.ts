export type AgentPluginsErrorCode =
  | "AGENT_PLUGIN_ROOT_INVALID"
  | "AGENT_PLUGIN_MANIFEST_INVALID"
  | "AGENT_PLUGIN_DECLARED_PATH_INVALID";

export class AgentPluginsError extends Error {
  readonly code: AgentPluginsErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: AgentPluginsErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "AgentPluginsError";
    this.code = code;
    this.details = details;
  }
}
