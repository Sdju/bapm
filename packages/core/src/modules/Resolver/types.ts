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
};

export type ResolveAndLockResult = {
  document: Record<string, unknown>;
  lockPath: string;
  nodes: ResolvedNode[];
};
