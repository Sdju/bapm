/**
 * Update — plan/apply scoped or full re-resolve (rs-011/rs-012) with lk-010 purge.
 */

export type { RunUpdateOptions, UpdatePlanEntry, UpdateResult } from "./types.ts";
export { UpdateError } from "./errors.ts";
export type { UpdateErrorCode } from "./errors.ts";
export { runUpdate, updateProject } from "./runUpdate.ts";
