import type { BapmManifest } from "@/modules/Manifest";
import type { LockfileDocument } from "@/modules/Lockfile";
import type { ResolvedNode } from "@/modules/Resolver";
import type { McpServerConfig } from "bapm-target-api";
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
  configPath?: string;
  targetId?: string;
};
