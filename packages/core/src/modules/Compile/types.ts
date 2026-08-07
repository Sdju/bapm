import type { TargetRegistry } from "bapm-integration-api";

export type CompileAttributionEntry = {
  name: string;
  type: string;
  path?: string;
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
  targetRegistry?: TargetRegistry;
  /** Explicit registered target id, bypassing target detection. */
  forcedTarget?: string;
};

export type CompileAgentsMdResult = {
  ok: boolean;
  path?: string;
  content: string;
  wrote: boolean;
  primitivesCount: number;
  /** Thin source attribution (name / type / path when known). */
  attribution: CompileAttributionEntry[];
};
