/**
 * Lockfile — discover / load / parse / serialize apm.lock.yaml & bapm.lock.yaml.
 *
 * ## Public API
 *
 * - Types: `DiscoverLockfileOptions`, `DiscoveredLockfile`, `LoadLockfileOptions`,
 *   `LoadLockfileResult`, `LockedDependency`, `LockfileDocument`, `LockfileInput`,
 *   `LockFilename`, `WriteLockfileOptions`, `LockfileErrorCode`
 * - Errors: `LockfileError`
 * - Constants: `APM_LOCK_FILE`, `BAPM_LOCK_FILE`
 * - Functions: `discoverLockfilePath`, `loadLockfile`, `loadLockfileOrNull`,
 *   `writeLockfile`, `parseLockfile`, `parseLockfileDocument`, `serializeLockfile`,
 *   `isSemanticallyEquivalent`
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
