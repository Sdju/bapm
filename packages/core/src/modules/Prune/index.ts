/**
 * Prune — remove orphan dirs under modules not in the resolved lock graph.
 */

export type { RunPruneOptions, PruneResult } from "./types.ts";
export { PruneError } from "./errors.ts";
export type { PruneErrorCode } from "./errors.ts";
export { runPrune, pruneModules, prune } from "./runPrune.ts";
