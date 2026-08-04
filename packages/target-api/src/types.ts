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

/** Detection predicate hook — true when this host should activate for the project. */
export type TargetDetectFn = (ctx: { cwd: string }) => boolean | Promise<boolean>;

/**
 * Host target contract. Concrete packages (e.g. bapm-target-cursor) implement this;
 * core only sees the shape via bapm-target-api.
 */
export type BapmTarget = {
  id: TargetId;
  /** Registered deploy root(s) relative to project cwd (tg-002). */
  deployRoots: string[];
  detect: TargetDetectFn;
  materialize: (
    primitives: AttributedPrimitiveSet,
    ctx?: MaterializeContext,
  ) => void | Promise<void>;
  getDeployRoots?: () => string[];
  [key: string]: unknown;
};

export type TargetRegistry = {
  register(target: BapmTarget): void;
  list(): BapmTarget[];
  get(id: TargetId): BapmTarget | undefined;
  getAll(): BapmTarget[];
};
