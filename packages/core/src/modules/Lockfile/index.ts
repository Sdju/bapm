/**
 * Lockfile — discover / load / parse / serialize apm.lock.yaml & bapm.lock.yaml
 * plus personal `bapm.local.lock.yaml` merge / partition.
 *
 * ## Public API
 *
 * - Types: `DiscoverLockfileOptions`, `DiscoveredLockfile`, `LoadLockfileOptions`,
 *   `LoadLockfileResult`, `LockedDependency`, `LockfileDocument`, `LockfileInput`,
 *   `LockFilename`, `WriteLockfileOptions`, `LockfileErrorCode`, `TreeSha256Violation`,
 *   `MergeLockDocumentsOptions`, `PartitionAndWriteOptions`, `PartitionAndWriteResult`
 * - Errors: `LockfileError`
 * - Constants: `APM_LOCK_FILE`, `BAPM_LOCK_FILE`, `BAPM_PERSONAL_LOCK_FILE`,
 *   `APM_PERSONAL_LOCK_FILE`, `PERSONAL_LOCK_SCOPE_KEY`
 * - Functions: `discoverLockfilePath`, `loadLockfile`, `loadLockfileOrNull`,
 *   `loadEffectiveLockfile`, `loadEffectiveLockfileOrNull`, `loadPersonalLockfileOrNull`,
 *   `mergeLockDocuments`, `partitionAndWriteLockfiles`, `writeLockfile`, …
 *
 * ## Example
 *
 * ```ts
 * import { loadEffectiveLockfile, partitionAndWriteLockfiles } from "@/modules/Lockfile";
 * const { document } = loadEffectiveLockfile({ cwd: process.cwd() });
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
export {
  loadEffectiveLockfile,
  loadEffectiveLockfileOrNull,
  loadMergedLockfile,
  mergeLoadLockfile,
  loadLockfileMerged,
} from "./effective.ts";
export type { LoadEffectiveLockfileOptions } from "./effective.ts";
export {
  APM_PERSONAL_LOCK_FILE,
  BAPM_PERSONAL_LOCK_FILE,
  PERSONAL_LOCK_SCOPE_KEY,
  PERSONAL_LOCK_SCOPE_VALUE,
  assertNoUnsupportedPersonalLockBrand,
  discoverPersonalLockfile,
  discoverPersonalLockfilePath,
  isPersonalScopeDependency,
  loadPersonalLockfileOrNull,
  personalLockfilePath,
  stampPersonalScope,
  stripPersonalScopeMarker,
} from "./personal.ts";
/** Alias for acceptance pickExport */
export { loadPersonalLockfileOrNull as loadLocalLockfileOrNull } from "./personal.ts";
export type { MergeLockDocumentsOptions } from "./merge.ts";
export { identityKey, mergeLockDocuments } from "./merge.ts";
/** Alias for acceptance pickExport */
export { mergeLockDocuments as mergeLockfiles } from "./merge.ts";
export { mergeLockDocuments as mergeLockfileDocuments } from "./merge.ts";
export type {
  PartitionAndWriteOptions,
  PartitionAndWriteResult,
  PartitionDocumentsResult,
} from "./partition.ts";
export {
  ensurePersonalLockGitignored,
  partitionAndWrite,
  partitionAndWriteLockfiles,
  partitionLockDocument,
} from "./partition.ts";
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
