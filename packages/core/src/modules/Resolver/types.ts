/**
 * Injectable ports for git remote / tag listing / download (fake-friendly for tests).
 */

export type FakeTag = { tag: string; commit: string };

export type TagLister = {
  listTags(repoUrl: string): Promise<FakeTag[]>;
};

export type GitRemote = {
  /** Resolve a literal ref (branch/tag/commit) to a 40-hex commit. */
  resolveRef(repoUrl: string, ref: string): Promise<string>;
};

export type DownloadArgs = {
  repoUrl?: string;
  path?: string;
  commit?: string;
  dest: string;
  identity?: string;
};

export type Downloader = {
  download(args: DownloadArgs): Promise<void>;
};

export type DependencyKind = "local" | "registry" | "git-semver" | "git-literal" | "marketplace";

export type ClassifiedDependency = {
  kind: DependencyKind;
  /** Original raw input preserved for diagnostics. */
  raw: unknown;
  path?: string;
  git?: string;
  ref?: string;
  id?: string;
  registry?: string;
  alias?: string;
  /** Manifest-level prerelease opt-in for git-semver. */
  prerelease?: boolean;
};

export type ResolvedNode = {
  name: string;
  identity: string;
  kind: DependencyKind;
  depth: number;
  resolved_by: string;
  /** Display / lock repo_url (host/path form without scheme when git). */
  repo_url?: string;
  path?: string;
  resolved_commit?: string;
  constraint?: string;
  resolved_tag?: string;
  resolved_at?: string;
  version?: string;
  /** Absolute path to materialized package tree (local source or modules cache). */
  packageRoot?: string;
  /** Registry lock fields (M10). */
  source?: string;
  resolved_url?: string;
  resolved_hash?: string;
  registry_base_url?: string;
  registry_owner?: string;
  registry_repo?: string;
};

export type ResolveGraphResult = {
  nodes: ResolvedNode[];
  /** Depth-1 visit order (declaration order among siblings). */
  visitOrder: string[];
};

export type ResolvePorts = {
  gitRemote?: GitRemote;
  tagLister?: TagLister;
  downloader?: Downloader;
};

export type ResolveDependencyGraphOptions = ResolvePorts & {
  cwd?: string;
  updateRefs?: boolean;
  /**
   * When set with `updateRefs`, only these package names (+ their subtrees)
   * re-resolve; other direct pins stay identical (OpenAPM rs-012).
   * Empty / omitted with updateRefs → full update (rs-011).
   */
  scope?: string[];
  /** Alias for `scope` (CLI / update API). */
  updatePackageNames?: string[];
  maxDepth?: number;
  /** When set, used for warm replay instead of loading from disk. */
  existingLock?: { dependencies?: Array<Record<string, unknown>> } | null;
  /**
   * Plan-only resolve: do not create `apm_modules` or download local path deps.
   * Local packages are read from source paths. Git still materializes when needed
   * to read child manifests (residual pl-002 gap for cold git trees).
   */
  skipDownload?: boolean;
  /** Alias for `skipDownload` (plan → gate → download). */
  planOnly?: boolean;
  /** Opt-in experimental registries (also via BAPM_EXPERIMENTAL_REGISTRIES=1). */
  experimentalRegistries?: boolean;
  /** Override registry base URL (tests). */
  registryBaseUrl?: string;
  /** Mirror base URL for rs-009 replay (tests / install). */
  mirrorUrl?: string;
};

export type DownloadPackageSpec = {
  repoUrl?: string;
  path?: string;
  commit?: string;
  identity?: string;
  name?: string;
};

export type DownloadPackagesOptions = ResolvePorts & {
  cwd?: string;
  packages: DownloadPackageSpec[];
  parallelDownloads?: number;
};

export type ResolveAndLockOptions = ResolvePorts & {
  cwd?: string;
  updateRefs?: boolean;
  /** Package scope for update (rs-012); see ResolveDependencyGraphOptions.scope. */
  scope?: string[];
  updatePackageNames?: string[];
  /**
   * When true (default on updateRefs), purge git-semver modules install paths
   * for scoped/full update targets before re-download (lk-010).
   */
  purgeInstallPaths?: boolean;
  parallelDownloads?: number;
  maxDepth?: number;
  verbose?: boolean;
  /** Explicit policy file path for install/lock gate. */
  policyPath?: string;
  /** Alias for `policyPath`. */
  policy?: string;
  /** Skip policy discovery + checks. */
  noPolicy?: boolean;
  experimentalRegistries?: boolean;
  registryBaseUrl?: string;
  mirrorUrl?: string;
};

export type ResolveAndLockResult = {
  document: Record<string, unknown>;
  lockPath: string;
  nodes: ResolvedNode[];
  /** Policy gate diagnostics when policy applied (M8). */
  policyDiagnostics?: unknown[];
};
