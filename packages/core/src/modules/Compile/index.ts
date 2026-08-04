/**
 * Compile — emit deterministic AGENTS.md from discovered primitives (cursor).
 *
 * ## Public API
 *
 * - `compileAgentsMd` / `compileProject` / `runCompile` / `emitAgentsMd`
 * - `--validate` skips durable write
 *
 * ## Example
 *
 * ```ts
 * import { compileAgentsMd } from "@/modules/Compile";
 * await compileAgentsMd({ cwd });
 * ```
 */

export type { CompileAgentsMdOptions, CompileAgentsMdResult } from "./types.ts";
export { compileAgentsMd, compileProject, runCompile, emitAgentsMd } from "./compileAgentsMd.ts";
