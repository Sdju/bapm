import type { ManifestWarning } from "./errors.ts";

/** Declared agentic dependency (APM package, skill path, plugin, MCP server, …). */
export type BapmDependency = {
  /** Spec string, e.g. `org/repo`, `org/repo/path`, `org/repo#v1.0.0`. */
  spec: string;
  kind?: "apm" | "mcp" | "skill" | "plugin" | "primitive";
};

/**
 * Object-form APM dependency. Source discriminators `git` | `id` | `path` |
 * `registry` | `marketplace` are mutually exclusive, except `path` may accompany
 * `git` as a virtual_path companion (`git: parent` requires `path`).
 */
export type ObjectDependency = {
  git?: string;
  id?: string;
  path?: string;
  registry?: string;
  /** Marketplace alias for `{ name, marketplace, version? }` form. */
  marketplace?: string;
  name?: string;
  version?: string;
  ref?: string;
  alias?: string;
  skills?: unknown;
  [key: string]: unknown;
};

export type DependencyEntry = string | ObjectDependency | BapmDependency;

/** Dependency list keys under `dependencies` / `devDependencies`. */
export type DependencyLists = {
  apm?: DependencyEntry[];
  mcp?: unknown[];
  lsp?: unknown[];
  [key: string]: unknown;
};

export type RegistryEntry = {
  url: string;
  /** Allow remote `http://` registry URL (OpenAPM §4.2.3 / sc-006). */
  insecure?: boolean;
  aliases?: unknown;
  [key: string]: unknown;
};

export type ManifestFilename = "apm.yml" | "bapm.yml";

/**
 * In-memory project manifest. Known fields are typed; unknown top-level and
 * `x-*` keys are retained on the same object for a future rewrite path.
 */
export type BapmManifest = {
  name: string;
  version: string;
  dependencies?: DependencyLists;
  devDependencies?: DependencyLists;
  registries?: Record<string, RegistryEntry | string>;
  default_host?: string;
  /** Single host target id (mutually exclusive with `targets`). Vendor ids `x-<vendor>-<name>` allowed. */
  target?: string;
  /** Multi host target ids (mutually exclusive with `target`). */
  targets?: string[];
  [key: string]: unknown;
};

export type DiscoverManifestOptions = {
  /** Project root; defaults to `process.cwd()`. No parent walk-up. */
  cwd?: string;
  /** Explicit manifest path; wins over discovery. */
  path?: string;
};

export type DiscoveredManifest = {
  path: string;
  /** Basename of the loaded file (`apm.yml` / `bapm.yml`, or explicit path basename). */
  filename: string;
};

export type LoadManifestOptions = DiscoverManifestOptions;

export type LoadManifestResult = {
  /** Validated document retaining unknown / `x-*` keys. */
  document: BapmManifest;
  sourcePath: string;
  sourceFilename: string;
  warnings?: ManifestWarning[];
};
