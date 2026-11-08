/**
 * Compile — delegate deterministic output emission to selected targets.
 *
 * ## Public API
 *
 * - `compileAgentsMd` / `compileProject` / `runCompile` / `emitAgentsMd`
 * - Single target (`forcedTarget`) or multi (`forcedTargets` / `all`)
 * - `distributed` opts into conservative per-directory `applyTo` placement
 * - `clean` removes orphaned generated outputs with a valid Build ID
 * - `validate` / `dryRun` skip durable write; `verbose` yields thin attribution
 * - `watchCompile` recompiles on relevant input changes; inject the watch
 *   factory (or use `once`) in tests
 *
 * ## Example
 *
 * ```ts
 * import { compileAgentsMd } from "@/modules/Compile";
 * compileAgentsMd({ cwd, dryRun: true, verbose: true });
 * compileAgentsMd({ cwd, forcedTargets: ["cursor", "claude"] });
 * ```
 */

export type {
  CompileAgentsMdOptions,
  CompileAgentsMdResult,
  CompileAttributionEntry,
  CompileCleanResult,
  CompileCleanSkip,
  CompileCleanSkipReason,
  CompileOutput,
} from "./types.ts";
export { compileAgentsMd, compileProject, runCompile, emitAgentsMd } from "./compileAgentsMd.ts";
export { cleanCompileOutputs, outputShapeFromPath } from "./clean.ts";
export type { CompileOutputShape } from "./clean.ts";
export {
  DEFAULT_COMPILE_WATCH_DEBOUNCE_MS,
  createNodeCompileWatchFactory,
  resolveCompileWatchTargets,
  watchCompile,
} from "./watch.ts";
export type {
  CompileWatchFactory,
  CompileWatchFactoryOptions,
  CompileWatchHandle,
  CompileWatchOptions,
  CompileWatchResult,
  CompileWatchTarget,
} from "./watch.ts";
