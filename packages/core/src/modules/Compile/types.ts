import type { DeploymentScope, IntegrationRegistry } from "@b-apm/integration-api";

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

export type CompileCleanSkipReason = "modified" | "unreadable" | "unlink-failed";

/** One stale generated output that clean refused to delete. */
export type CompileCleanSkip = {
  /** Project-relative path. */
  path: string;
  reason: CompileCleanSkipReason;
};

/** Result of the `clean` phase (`compile --clean`). */
export type CompileCleanResult = {
  /** Stale generated outputs deleted by this invocation. */
  removed: string[];
  /** Stale generated outputs a `--dry-run` preview would delete. */
  wouldRemove: string[];
  /** Candidates kept because they were modified, unreadable, or undeletable. */
  skipped: CompileCleanSkip[];
};

export type CompileAgentsMdOptions = {
  /** Project root; fallback for both `manifestCwd` and `deployCwd`. */
  cwd?: string;
  /**
   * Root for manifest, lock, modules and primitive discovery. Defaults to
   * `cwd`. A global compile passes the `~/.bapm` (`BAPM_HOME`) root here so
   * project files are never read.
   */
  manifestCwd?: string;
  /**
   * Root for host compile outputs. Defaults to `cwd`. A global compile passes
   * the user home so `~/.cursor`, `~/.claude`, and `~/.codex` receive files
   * while the manifest root stays under `~/.bapm`.
   */
  deployCwd?: string;
  /**
   * Deployment scope. `global` requires a home-relative
   * `globalCompileOutput` on each selected integration and uses the user home
   * as the output root; unsupported hosts fail closed.
   */
  scope?: DeploymentScope;
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
   * Opt-in distributed placement: instruction primitives with `applyTo` write
   * host output files in their literal target directories. The default remains
   * one single-file output per selected host.
   */
  distributed?: boolean;
  /**
   * Remove orphaned generated outputs for the selected hosts (APM `--clean`).
   * Only files with a valid Build ID that are not part of this invocation's
   * planned output set are candidates. `dryRun` previews removals; `validate`
   * wins and never deletes.
   */
  clean?: boolean;
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
  /** Present when `clean` was requested and `validate` did not suppress it. */
  clean?: CompileCleanResult;
};
