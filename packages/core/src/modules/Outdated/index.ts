/**
 * Outdated — compare lock pins to remote tips / annotated revision pins.
 */

export type { OutdatedRow, OutdatedResult, RunOutdatedOptions } from "./types.ts";
export { DEFAULT_PARALLEL_CHECKS } from "./types.ts";
export { OutdatedError } from "./errors.ts";
export type { OutdatedErrorCode } from "./errors.ts";
export { runOutdated, checkOutdated, outdated } from "./runOutdated.ts";
export {
  abbreviateSha,
  findLatestAnnotatedTag,
  isFullRevisionPin,
  packageBasenameFromRepo,
} from "./revisionPin.ts";
export type { AnnotatedTagCandidate } from "./revisionPin.ts";
