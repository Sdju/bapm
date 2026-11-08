import type { BapmManifest } from "@/modules/Manifest";
import type { ResolvedNode } from "@/modules/Resolver";
import type { LspServerConfig } from "@b-apm/integration-api";

/** Canonical LSP declaration parsed from `dependencies.lsp` / `devDependencies.lsp`. */
export type ParsedLspServer = LspServerConfig & {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  extensionToLanguage: Record<string, string>;
  /** Original YAML object, retained for read-only inspection output. */
  raw: Record<string, unknown>;
};

/** One LSP server eligible for deploy after collection rules. */
export type CollectedLspServer = ParsedLspServer & {
  /** `direct` = root dependencies.lsp; `dependency` = from a package. */
  origin: "direct" | "dependency";
  packageName: string;
  /** Stable lock provenance token (`project:.` or `package:<name>`). */
  owner: string;
};

export type CollectLspServersOptions = {
  cwd?: string;
  rootManifest: BapmManifest;
  nodes?: readonly ResolvedNode[];
  /** Include dependency manifests (default true; parity with APM LSP collection). */
  includeDependencies?: boolean;
};

export type CollectLspServersResult = {
  servers: CollectedLspServer[];
  /** Dependency packages that contributed LSP servers. */
  dependencyPackages: string[];
};

export type LspDeclarationContext = {
  packageName?: string;
  /** Manifest path for actionable error messages. */
  path?: string;
};

export type ApplyLspInventoryOptions = {
  document: Record<string, unknown>;
  servers: readonly CollectedLspServer[];
  /** Target id -> server names written for that target during this run. */
  targetServers?: Record<string, readonly string[]>;
};
