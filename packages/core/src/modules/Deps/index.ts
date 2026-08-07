/**
 * Deps — list / tree / why inspect from lock.
 *
 * `why` is implemented as an offline reverse walk when lock edges
 * (`resolved_by` / nested `dependencies`) are present (rs-005 SHOULD).
 */

export type {
  DepsListResult,
  DepsTreeResult,
  DepsWhyError,
  DepsWhyPackage,
  DepsWhyPath,
  DepsWhyPathNode,
  DepsWhyResult,
  RunDepsOptions,
} from "./types.ts";
export { listDeps, depsList, runDepsList } from "./listDeps.ts";
export { treeDeps, depsTree, runDepsTree } from "./treeDeps.ts";
export { whyDeps, depsWhy, runDepsWhy } from "./whyDeps.ts";
export { resolvePackageQuery, repoBasename, repoOwnerRepo } from "./resolvePackageQuery.ts";
