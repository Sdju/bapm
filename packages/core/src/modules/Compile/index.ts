/**
 * Compile — delegate deterministic output emission to selected targets.
 *
 * ## Public API
 *
 * - `compileAgentsMd` / `compileProject` / `runCompile` / `emitAgentsMd`
 * - Single target (`forcedTarget`) or multi (`forcedTargets` / `all`)
 * - `validate` / `dryRun` skip durable write; `verbose` yields thin attribution
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
  CompileOutput,
} from "./types.ts";
export { compileAgentsMd, compileProject, runCompile, emitAgentsMd } from "./compileAgentsMd.ts";
