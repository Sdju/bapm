import type { Downloader, GitRemote, TagLister } from "@/modules/Resolver";
import type { IntegrationRegistry } from "@b-apm/integration-api";

export type InstallOnlyMode = "apm" | "mcp";

export type RunInstallOptions = {
  cwd?: string;
  frozen?: boolean;
  /** Rejected when combined with frozen. */
  update?: boolean;
  updateRefs?: boolean;
  /**
   * Preview-only install: no durable project writes (manifest/lock/modules/harness),
   * no target materialize / configureMcp. Never forwarded to targets.
   */
  dryRun?: boolean;
  /**
   * Accept overwrite / future security-gate bypass. MUST NOT refresh refs,
   * bypass frozen, or disable policy. Distinct from `forcedTarget`.
   */
  force?: boolean;
  /** Dual-consent CLI half for direct `http://` dependencies. */
  allowInsecure?: boolean;
  /** Repeatable host allowlist for transitive `http://` dependencies (FQDN). */
  allowInsecureHosts?: string[];
  /**
   * When set with `packageRefs`, write under `devDependencies.apm` instead of
   * `dependencies.apm`. Without positional refs, no-op.
   */
  dev?: boolean;
  /**
   * Install mode: `apm` skips MCP configure; `mcp` skips APM package
   * download/materialize. Omit = both sides.
   */
  only?: InstallOnlyMode;
  /**
   * Positional package refs to add under `dependencies.apm` before install
   * (non-zip). Mutually exclusive with `archivePath`.
   */
  packageRefs?: string[];
  /**
   * Skip MCP configure for listed target/runtime ids (e.g. `cursor`).
   * Does not skip package materialize. Alias: `exclude`.
   */
  excludeTargets?: string[];
  /** Alias for `excludeTargets`. */
  exclude?: string[];
  /**
   * Force activation of a registered target id even when `detect` is false
   * (e.g. CLI `--target cursor`). Alias: `forceTarget`.
   */
  forcedTarget?: string;
  /** Alias for `forcedTarget`. */
  forceTarget?: string;
  /** Injected target registry (from @b-apm/integration-api). */
  integrationRegistry?: IntegrationRegistry;
  /** Alias accepted by acceptance helpers. */
  registry?: IntegrationRegistry;
  /** Override active target ids (else from manifest / detection / forced). */
  activeTargets?: string[];
  /**
   * Download concurrency (default aligned with APM = 4). `0` = serial.
   */
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
  fetchAncestor?: (ref: string, context: { leafHostClass: string; chain: string[] }) => unknown;
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
  /** Override `~/.bapm` for marketplace registry during install resolve. */
  marketplaceConfigDir?: string;
  configDir?: string;
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
  /** True when install returned after dry-run preview (no durable writes). */
  dryRun?: boolean;
};

export type EnforceFrozenOptions = {
  cwd?: string;
  updateRefs?: boolean;
  update?: boolean;
};
