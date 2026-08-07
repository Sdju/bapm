/**
 * Shared target contracts for core ↔ host packages.
 */

/** Target identifier (built-in like `cursor`, or vendor `x-<vendor>-<name>`). */
export type TargetId = string;

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
  /** Complete portable Agent Plugin skill directory, when applicable. */
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
  [key: string]: unknown;
};

/**
 * Report returned by `configureMcp` so core can record lock `mcp_*` inventory
 * without importing concrete host packages.
 */
export type ConfigureMcpReport = {
  /** Registered target that owns the reported MCP deployment. */
  targetId?: TargetId;
  /** Project-/cwd-relative path to the written target MCP config. */
  configPath: string;
  /** Server names written/updated. */
  servers?: string[];
  deployedFiles?: DeployedFile[];
  /** Explicit adapter decisions or unsupported-server diagnostics. */
  diagnostics?: Array<{ code: string; message: string; server?: string }>;
};

/** Optional MCP configure hook — targets that lack it are skipped for MCP. */
export type ConfigureMcpFn = (
  servers: McpServerConfig[] | Record<string, McpServerConfig>,
  ctx?: ConfigureMcpContext,
) => ConfigureMcpReport | Promise<ConfigureMcpReport>;

/** Concrete target contract consumed by core only through `bapm-target-api`. */
export type BapmTarget = {
  id: TargetId;
  /** Registered deploy root(s) relative to project cwd (tg-002). */
  deployRoots: string[];
  detect: TargetDetectFn;
  materialize: (
    primitives: AttributedPrimitiveSet,
    ctx?: MaterializeContext,
  ) => void | MaterializeReport | Promise<void | MaterializeReport>;
  getDeployRoots?: () => string[];
  /** Optional host-agnostic MCP configure; targets without it are skipped for MCP. */
  configureMcp?: ConfigureMcpFn;
  /** Optional host-owned compile rendering and output placement. */
  compile?: CompileFn;
  [key: string]: unknown;
};

export type TargetRegistry = {
  register(target: BapmTarget): void;
  list(): BapmTarget[];
  get(id: TargetId): BapmTarget | undefined;
  getAll(): BapmTarget[];
  /** Evaluate each registered detector once, treating failures as non-matches. */
  detect(cwd: string): Promise<DetectedTargetsResult>;
};
