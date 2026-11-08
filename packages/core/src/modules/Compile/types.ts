import type { IntegrationRegistry } from "@b-apm/integration-api";

export type CompileAttributionEntry = {
  name: string;
  type: string;
  path?: string;
};

/** One host's compile emission in a single invocation (possibly multi-target). */
export type CompileOutput = {
  /** Registered target that owns this output. */
  targetId: string;
  /** Project-relative output path reported by the target. */
  path: string;
  /** True when this invocation durably wrote the output. */
  wrote: boolean;
};

export type CompileAgentsMdOptions = {
  cwd?: string;
  /** When true, discover/validate only — do not write target output. */
  validate?: boolean;
  /** When true (and not validate), compute content but do not write. */
  dryRun?: boolean;
  /** When true, include thin attribution on the result for CLI printing. */
  verbose?: boolean;
  /** Target-relative output override; the target owns its default. */
  outputFile?: string;
  modulesDir?: string;
  /** Registry of host target capabilities supplied by the application. */
  integrationRegistry?: IntegrationRegistry;
  /** Explicit registered target id, bypassing target detection. */
  forcedTarget?: string;
  /** Explicit registered target ids; emits one output per host in one invocation. */
  forcedTargets?: string[];
  /** Select every registered compile-capable target (project scope). */
  all?: boolean;
  /**
   * User-config target default (`~/.bapm/config.json` `target`). Applied after
   * manifest/local-overlay `active` and before auto-detect.
   */
  configTarget?: string;
};

export type CompileAgentsMdResult = {
  ok: boolean;
  /** First output's path (single-target compatibility; multi-target uses `outputs`). */
  path?: string;
  /** First output's rendered content (single-target compatibility). */
  content: string;
  /** True when every selected output was durably written. */
  wrote: boolean;
  primitivesCount: number;
  /** Thin source attribution (name / type / path when known). */
  attribution: CompileAttributionEntry[];
  /** One entry per selected target, in selection order. */
  outputs: CompileOutput[];
};
