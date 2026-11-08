/**
 * Shared target contracts for core ↔ host packages.
 */

/** Target identifier (built-in like `cursor`, or vendor `x-<vendor>-<name>`). */
export type TargetId = string;

/**
 * Deployment scope. `project` writes under the project cwd (default);
 * `global` writes user-scoped host files selected by the integration.
 */
export type DeploymentScope = "project" | "global";

/** Source attribution for a discovered primitive (OpenAPM pr-001). */
export type PrimitiveSource = "local" | `dependency:${string}`;

/** Primitive kinds in the M4 discovery floor (skill | agent | instruction | …). */
export type PrimitiveType = string;

/** Attributed primitive unit passed to materialize. */
export type AttributedPrimitive = {
  name: string;
  type: PrimitiveType;
  source: PrimitiveSource;
  /** Absolute or project-relative path to the source file/dir. */
  path: string;
  /** Package name when source is dependency:<name>. */
  packageName?: string;
  /** Optional raw content hint; hosts may re-read from path. */
  content?: string;
  /** Complete skill directory (native or portable Agent Plugin), when applicable. */
  skillDirectory?: string;
  /** Resolved portable plugin root for containment-aware targets. */
  pluginRoot?: string;
  /** Identifies the portable Agent Plugins skill format. */
  format?: "agent-plugin";
  [key: string]: unknown;
};

/** Conflict-resolved set (or array) accepted by materialize. */
export type AttributedPrimitiveSet =
  | AttributedPrimitive[]
  | {
      primitives: AttributedPrimitive[];
      diagnostics?: unknown[];
    };

/** Context supplied when invoking materialize. */
export type MaterializeContext = {
  cwd: string;
  /** Active target id for this invocation. */
  targetId: TargetId;
  /** Deploy roots declared by the target (relative to cwd). */
  deployRoots: string[];
  /** Project (default) or user-global deployment. */
  scope?: DeploymentScope;
  [key: string]: unknown;
};

/** One harness file written by materialize (cwd-relative path). */
export type DeployedFile = {
  /** Project-/cwd-relative path using `/` separators. */
  path: string;
  /** Optional content hash (host may omit; core can compute). */
  hash?: string;
  /**
   * Target-supplied primitive ownership for this deployment. Core uses this
   * metadata for lock attribution and never infers it from a host file layout.
   */
  primitive?: {
    name: string;
    packageName?: string;
  };
};

/**
 * Report returned by `materialize` so core can record lock inventory
 * (`deployed_file_hashes`) without importing concrete host packages.
 */
export type MaterializeReport = {
  /** Registered target that owns these deployment entries when any are reported. */
  targetId?: TargetId;
  deployedFiles: DeployedFile[];
  /** Non-fatal adapter notes (frontmatter drops, unsupported primitive skips, …). */
  diagnostics?: Array<{ code?: string; message: string; [key: string]: unknown }>;
};

/** Detection predicate hook — true when this host should activate for the project. */
export type TargetDetectFn = (ctx: { cwd: string }) => boolean | Promise<boolean>;

/** A non-sensitive reason why a registered target was not detected. */
export type TargetDetectionDiagnostic = {
  targetId: TargetId;
  message: string;
};

/** Result of evaluating every registered target exactly once. */
export type DetectedTargetsResult = {
  detectedIds: TargetId[];
  diagnostics: TargetDetectionDiagnostic[];
};

/** Context owned by core while a target emits its compile output. */
export type CompileContext = {
  cwd: string;
  outputFile?: string;
  /** Core-owned write intent; false for validation and preview requests. */
  write: boolean;
  /**
   * Core-owned distributed placement intent. When true, hosts that normally
   * omit instruction primitives (because install materializes them as native
   * rules) MUST render them into this compile output instead.
   */
  includeInstructions?: boolean;
};

/** Target-owned compile emission result. Paths are project-relative. */
export type CompileReport = {
  path: string;
  content: string;
  wrote: boolean;
};

export type CompileFn = (
  primitives: AttributedPrimitiveSet,
  context: CompileContext,
) => CompileReport | Promise<CompileReport>;

/**
 * Host-agnostic MCP server definition passed to optional `configureMcp`.
 * Concrete targets map transport, command, or URL into their native config shape.
 */
export type McpServerConfig = {
  name: string;
  transport?: string;
  type?: string;
  command?: string;
  args?: unknown[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
  /** Package provenance (dependency name or local). */
  packageName?: string;
  [key: string]: unknown;
};

/** Context for optional MCP configure. */
export type ConfigureMcpContext = {
  cwd: string;
  /** Active target id for this invocation. */
  targetId?: TargetId;
  /** Deploy roots declared by the target (relative to cwd). */
  deployRoots?: string[];
  /**
   * Project (default) or user-global deployment. Global integrations must
   * select a user-scoped config path instead of writing under `cwd`.
   */
  scope?: DeploymentScope;
  /**
   * Server names bapm previously wrote for this target that are no longer in
   * the approved set (for example after `bapm deny`). Targets that own a
   * mergeable config must remove these entries while leaving foreign servers
   * untouched.
   */
  managedServers?: string[];
  [key: string]: unknown;
};

/**
 * Report returned by `configureMcp` so core can record lock `mcp_*` inventory
 * without importing concrete host packages.
 */
export type ConfigureMcpReport = {
  /** Registered target that owns the reported MCP deployment. */
  targetId?: TargetId;
  /**
   * Path to the written target MCP config: project-/cwd-relative for project hosts,
   * or absolute / `~/…` for home-scoped hosts.
   */
  configPath: string;
  /** Server names written/updated. */
  servers?: string[];
  deployedFiles?: DeployedFile[];
  /** Explicit adapter decisions or unsupported-server diagnostics. */
  diagnostics?: Array<{
    code: string;
    message: string;
    server?: string;
    /** Surface as `bapm: warning:` during install (skip/opt-in decisions). */
    warn?: boolean;
    /** Host target that made the decision, when relevant. */
    target?: TargetId;
    /** Host directory/path referenced by the decision, when relevant. */
    dir?: string;
    [key: string]: unknown;
  }>;
};

/** Optional MCP configure hook — targets that lack it are skipped for MCP. */
export type ConfigureMcpFn = (
  servers: McpServerConfig[] | Record<string, McpServerConfig>,
  ctx?: ConfigureMcpContext,
) => ConfigureMcpReport | Promise<ConfigureMcpReport>;

/**
 * Install-time MCP env policy for a host.
 * - `bake` (default when omitted): resolve APM `${VAR}` / `${env:VAR}` / `<VAR>` to literals before configure
 * - `translate`: pass APM placeholders through; host writes runtime `${VAR}` forms
 * Bapm `{bake:NAME}` directives are still resolved (fail-closed) for both modes.
 */
export type McpEnvMode = "bake" | "translate";

/** Concrete target contract consumed by core only through `@b-apm/integration-api`. */
export type BapmIntegration = {
  id: TargetId;
  /** Registered deploy root(s) relative to project cwd (tg-002). */
  deployRoots: string[];
  detect: TargetDetectFn;
  /**
   * Optional user-scope detection (global install). Project `detect` markers
   * are meaningless at the global root, so core calls this instead when
   * `scope: "global"`. Omitted ⇒ the target never auto-detects globally.
   */
  detectGlobal?: TargetDetectFn;
  materialize: (
    primitives: AttributedPrimitiveSet,
    ctx?: MaterializeContext,
  ) => void | MaterializeReport | Promise<void | MaterializeReport>;
  getDeployRoots?: () => string[];
  /** Optional host-agnostic MCP configure; targets without it are skipped for MCP. */
  configureMcp?: ConfigureMcpFn;
  /** Optional host-owned compile rendering and output placement. */
  compile?: CompileFn;
  /**
   * Optional MCP env handling mode. Omitted ⇒ bake-compatible (Cursor default).
   * Install reads this through the api contract — no host-id allowlists in core.
   */
  mcpEnvMode?: McpEnvMode;
  /**
   * Optional MCP `headers` handling mode. Omitted ⇒ inherit `mcpEnvMode`.
   * Hosts such as Codex bake `env` at install time but translate header
   * references into host-native indirection instead of writing secrets.
   */
  mcpHeadersEnvMode?: McpEnvMode;
  /**
   * Where `configureMcp` writes by contract. `home` means a user-global file
   * shared by every project on the machine; install warns about the collision
   * and supports `--exclude` as the opt-out. Omitted ⇒ `project`.
   */
  mcpScope?: "project" | "home";
  /**
   * True when `configureMcp` understands `scope: "global"` and writes a
   * user-scoped config. Core refuses global MCP for targets without this.
   */
  supportsGlobalMcp?: true;
  [key: string]: unknown;
};

export type IntegrationRegistry = {
  register(target: BapmIntegration): void;
  list(): BapmIntegration[];
  get(id: TargetId): BapmIntegration | undefined;
  getAll(): BapmIntegration[];
  /** Evaluate each registered detector once, treating failures as non-matches. */
  detect(cwd: string): Promise<DetectedTargetsResult>;
};

/**
 * Host-owned marketplace output. The neutral payload types deliberately avoid
 * describing any host document schema; integrations own that representation.
 */
export type MarketplaceOutputCapability = {
  format: string;
  defaultOutput: string;
  map: (config: unknown, resolved: unknown[]) => Record<string, unknown>;
};

/** Marketplace-only integrations need no runtime detect or deployment hooks. */
export type MarketplaceOutputIntegration = {
  id: string;
  marketplaceOutput: MarketplaceOutputCapability;
};

export type MarketplaceOutputRegistry = {
  register(integration: MarketplaceOutputIntegration): void;
  list(): MarketplaceOutputIntegration[];
  get(format: string): MarketplaceOutputIntegration | undefined;
};
