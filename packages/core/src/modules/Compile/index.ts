/**
 * Compile — emit deterministic AGENTS.md from discovered primitives (cursor).
 *
 * ## Public API
 *
 * - `compileAgentsMd` / `compileProject` / `runCompile` / `emitAgentsMd`
 * - `validate` / `dryRun` skip durable write; `verbose` yields thin attribution
 *
 * ## Example
 *
 * ```ts
 * import { compileAgentsMd } from "@/modules/Compile";
 * compileAgentsMd({ cwd, dryRun: true, verbose: true });
 * ```
 */

export type {
  CompileAgentsMdOptions,
  CompileAgentsMdResult,
  CompileAttributionEntry,
} from "./types.ts";
export { compileAgentsMd, compileProject, runCompile, emitAgentsMd } from "./compileAgentsMd.ts";
