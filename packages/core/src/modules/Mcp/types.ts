import type { BapmManifest } from "@/modules/Manifest";
import type { LockfileDocument } from "@/modules/Lockfile";
import type { ResolvedNode } from "@/modules/Resolver";
import type { McpServerConfig } from "@b-apm/integration-api";
import type { ExecutableGrantSurface } from "@/modules/ExecutableTrust";

export type CollectedMcpServer = McpServerConfig & {
  /** `direct` = root dependencies.mcp; `dependency` = from a package. */
  origin: "direct" | "dependency";
  packageName: string;
};

export type CollectMcpServersOptions = {
  cwd?: string;
  rootManifest: BapmManifest;
  nodes?: ResolvedNode[];
  /** Deploy transitive MCP when no grant gate applies. */
  trustTransitiveMcp?: boolean;
  /** Parsed grant surface (when present, dep MCP is evaluated even without trust flag). */
  grantSurface?: ExecutableGrantSurface;
};

export type CollectMcpServersResult = {
  /** Servers eligible for deploy after collection rules (before trust withhold). */
  servers: CollectedMcpServer[];
  /** Dependency packages that contributed MCP candidates needing trust evaluation. */
  dependencyPackages: string[];
  diagnostics: unknown[];
};

export type ApplyMcpInventoryOptions = {
  document: LockfileDocument;
  servers: Array<{ name: string; packageName?: string; [key: string]: unknown }>;
  /** Target that received the config. Omit to refresh `mcp_servers` without inventing target inventory. */
  targetId?: string;
  /** Host config path; only written together with `targetId`. */
  configPath?: string;
  /**
   * Every target configured during this run. Complements the legacy single
   * `targetId`/`configPath` pair; each entry is recorded in `mcp_configs` and
   * `mcp_target_servers`.
   */
  targets?: Array<{ targetId: string; configPath: string }>;
};

export type ScrubMcpInventoryOptions = {
  document: LockfileDocument;
  /** Drop every MCP inventory bag (`mcp_servers`, `mcp_configs`, target maps, provenance). */
  all?: boolean;
  /** Root package whose server entries are stale even when dependency entries are preserved. */
  rootPackageName?: string;
  /**
   * Dependency packages still present in the current resolution. When omitted or
   * empty, all dependency-owned entries are preserved.
   */
  livePackageNames?: readonly string[];
};
