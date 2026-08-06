/**
 * Find — offline reverse lookup of which locked package(s) own a deployed path.
 *
 * Built from lock inventory (`deployed_file_hashes` / `local_deployed_file_hashes`
 * plus optional list fields). No Marketplace / network I/O.
 */

export type { FindPathOptions, FindPathResult, ReverseIndex } from "./types.ts";
export { WORKSPACE_OWNER_KEY } from "./types.ts";

export {
  buildReverseIndex,
  build_reverse_index,
  buildFindReverseIndex,
  packageOwnerKey,
} from "./buildReverseIndex.ts";

export {
  lookupInIndex,
  lookup,
  lookupFindPath,
  lookupReverseIndex,
  normalizeFindPath,
} from "./lookup.ts";

export {
  formatFindOwnerLabel,
  ownerLabel,
  formatOwnerLabel,
  findOwnerLabel,
  formatFindOrigin,
  formatOrigin,
  formatSourceOrigin,
  _formatOrigin,
} from "./format.ts";

export { findPath, runFind, findDeployedPath, runFindPath } from "./findPath.ts";
