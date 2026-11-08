/** Shared types for the read-only executable inventory views. */

/** Executable types the trust ladder understands. */
export const EXECUTABLE_TYPES = ["mcp", "bin", "hook"] as const;
export type ExecutableType = (typeof EXECUTABLE_TYPES)[number];

/** Canonical display order: MCP first, then bin, then hook. */
export const EXECUTABLE_TYPE_ORDER: readonly ExecutableType[] = EXECUTABLE_TYPES;

export type UserExecutableGrantEntry = {
  package: string;
  grant: "allow" | "deny";
  /** Truthy keys from the grant entry; known executable types first. */
  types: string[];
  source: "user";
};

export type UserExecutableGrantList = {
  source: "user";
  /** Absolute path to `<configRoot>/config.json`. */
  path: string;
  /** True when config.json declared an `executables` bag. */
  present: boolean;
  grants: UserExecutableGrantEntry[];
};

export type PendingExecutablePackage = {
  package: string;
  /** Executable types with no explicit allow/deny decision. */
  types: ExecutableType[];
  reason: string;
};

export type PendingExecutablesOptions = {
  cwd?: string;
  /** Override user config root (defaults to `~/.bapm`). */
  configRoot?: string;
  /** Explicit policy path (org deny surface). */
  policyPath?: string;
  /** Full policy escape. */
  noPolicy?: boolean;
  /** Skip repository-local policy only; org deny still applies. */
  noRepoPolicy?: boolean;
};

export type PendingExecutablesResult = {
  lockfile: string | null;
  manifest: string | null;
  pending: PendingExecutablePackage[];
};
