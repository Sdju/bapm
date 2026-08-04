/**
 * Lockfile — discover / load / parse / serialize apm.lock.yaml & bapm.lock.yaml.
 *
 * ## Public API
 *
 * - Types: `DiscoverLockfileOptions`, `DiscoveredLockfile`, `LoadLockfileOptions`,
 *   `LoadLockfileResult`, `LockedDependency`, `LockfileDocument`, `LockfileInput`,
 *   `LockFilename`, `WriteLockfileOptions`, `LockfileErrorCode`, `TreeSha256Violation`
 * - Errors: `LockfileError`
 * - Constants: `APM_LOCK_FILE`, `BAPM_LOCK_FILE`
 * - Functions: `discoverLockfilePath`, `loadLockfile`, `loadLockfileOrNull`,
 *   `writeLockfile`, `parseLockfile`, `parseLockfileDocument`, `serializeLockfile`,
 *   `isSemanticallyEquivalent`, `computeCanonicalTreeSha256`,
 *   `collectTreeSha256Violations`, …
 *
 * ## Example
 *
 * ```ts
 * import { loadLockfile, serializeLockfile } from "@/modules/Lockfile";
 * const { document } = loadLockfile({ cwd: process.cwd() });
 * ```
 */
export type {
  DiscoverLockfileOptions,
  DiscoveredLockfile,
  LoadLockfileOptions,
  LoadLockfileResult,
  LockedDependency,
  LockfileDocument,
  LockfileInput,
  LockFilename,
  WriteLockfileOptions,
} from "./types.ts";

export type { LockfileErrorCode } from "./errors.ts";
export { LockfileError } from "./errors.ts";

export { APM_LOCK_FILE, BAPM_LOCK_FILE, discoverLockfilePath } from "./discover.ts";
export { loadLockfile, loadLockfileOrNull, writeLockfile } from "./load.ts";
export { parseLockfile, parseLockfileDocument } from "./parse.ts";
export { serializeLockfile } from "./serialize.ts";
export { isSemanticallyEquivalent } from "./equivalence.ts";
export type { TreeSha256Violation } from "./treeSha256.ts";
export {
  computeCanonicalTreeSha256,
  treeSha256Equal,
  formatTreeSha256Violation,
  isGitSourcedLockEntry,
  locateGitPackageTree,
  collectTreeSha256Violations,
} from "./treeSha256.ts";
