import type { Downloader, GitRemote, TagLister } from "@/modules/Resolver";
import type { TargetRegistry } from "bapm-target-api";

export type RunInstallOptions = {
  cwd?: string;
  frozen?: boolean;
  /** Rejected when combined with frozen. */
  update?: boolean;
  updateRefs?: boolean;
  /**
   * Force activation of a registered target id even when `detect` is false
   * (e.g. CLI `--target cursor`). Alias: `forceTarget`.
   */
  forcedTarget?: string;
  /** Alias for `forcedTarget`. */
  forceTarget?: string;
  /** Injected target registry (from bapm-target-api). */
  targetRegistry?: TargetRegistry;
  /** Alias accepted by acceptance helpers. */
  registry?: TargetRegistry;
  /** Override active target ids (else from manifest / detection / forced). */
  activeTargets?: string[];
  parallelDownloads?: number;
  maxDepth?: number;
  verbose?: boolean;
  gitRemote?: GitRemote;
  tagLister?: TagLister;
  downloader?: Downloader;
  /**
   * Local pack zip path — extract into project root before install orchestration
   * (M7 install-from-archive round-trip).
   */
  archivePath?: string;
  /** Explicit policy file path (`--policy`). */
  policyPath?: string;
  /** Alias for `policyPath`. */
  policy?: string;
  /** Skip policy discovery + checks (`--no-policy` / env disable). */
  noPolicy?: boolean;
  /** Override ordered policy discovery providers. */
  policyProviders?: string[];
  /** Alias for `policyProviders`. */
  providers?: string[];
  /** Injectable git remotes for pl-012 / remote discovery. */
  listGitRemotes?: (cwd?: string) => Array<{ name: string; url: string }>;
  remotes?: Array<{ name: string; url: string }>;
  /** Injectable HTTP for remote policy / extends. */
  fetchPolicyUrl?: (url: string) => {
    ok?: boolean;
    text?: string;
    body?: string;
    status?: number;
    url?: string;
  };
  httpGet?: (url: string) => {
    ok?: boolean;
    text?: string;
    body?: string;
    status?: number;
    url?: string;
  };
  /** Injectable extends ancestor fetcher. */
  fetchAncestor?: (
    ref: string,
    context: { leafHostClass: string; chain: string[] },
  ) => unknown;
  /** When remote fetch fails before a document exists (pl-010). */
  defaultFetchFailure?: "off" | "warn" | "block";
  implementationDefaultHost?: string;
  /**
   * Deploy transitive (dependency) MCP servers when no grant surface applies
   * (`--trust-transitive-mcp`). Direct `dependencies.mcp` always eligible.
   */
  trustTransitiveMcp?: boolean;
  experimentalRegistries?: boolean;
  registryBaseUrl?: string;
  mirrorUrl?: string;
};

/** Alias for design naming flexibility. */
export type InstallOptions = RunInstallOptions;

export type InstallResult = {
  ok: true;
  lockPath?: string;
  modulesDir: string;
  activeTargets: string[];
  primitivesCount: number;
  diagnostics: unknown[];
  /** Policy gate warnings / findings (M8). */
  policyDiagnostics?: unknown[];
};

export type EnforceFrozenOptions = {
  cwd?: string;
  updateRefs?: boolean;
  update?: boolean;
};
