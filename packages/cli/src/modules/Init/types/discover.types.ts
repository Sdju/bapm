/** Read-only inventory of existing agent harness content for `init --discover`. */

export type DiscoveryKind = "skills" | "rules" | "commands" | "hooks" | "mcp";

export type DiscoveryEntry = {
  /** cwd-relative path using `/` separators. */
  path: string;
  /** Host inferred from the path, or null for shared / `.apm/` content. */
  host: string | null;
  /** Server, event, primitive, or file stem when known. */
  name?: string;
};

export type DiscoveryInventory = Record<DiscoveryKind, DiscoveryEntry[]>;

export type DiscoveryCounts = {
  hosts: number;
  skills: number;
  rules: number;
  commands: number;
  hooks: number;
  mcp: number;
};

export type DiscoveredHost = {
  id: string;
  /** Matched relative marker paths (for example `.cursor` or `CLAUDE.md`). */
  markers: string[];
};

export type ProjectDiscoveryReport = {
  schemaVersion: 1;
  cwd: string;
  manifest: {
    exists: boolean;
    /** `bapm.yml` / `apm.yml` when present, otherwise null. */
    path: string | null;
  };
  hosts: DiscoveredHost[];
  /** Recommended `active` target ids (detected hosts, sorted by id). */
  suggestedActive: string[];
  inventory: DiscoveryInventory;
  counts: DiscoveryCounts;
  /** False for preview; true when `--apply` wrote a manifest. */
  applied: boolean;
  /** Absolute manifest path after a successful `--apply`. */
  manifestPath?: string;
};
