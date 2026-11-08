/**
 * Read-only executable inventory for `bapm approve --list` / `--pending`.
 *
 * Grants come from the same user store as `bapm approve`; pending packages are
 * assembled from the MCP lock inventory and executable files in materialized
 * dependency roots. No lock/manifest/config writes.
 */
export type { ExecutableType, UserExecutableGrantEntry, UserExecutableGrantList } from "./types.ts";
export type {
  PendingExecutablePackage,
  PendingExecutablesOptions,
  PendingExecutablesResult,
} from "./types.ts";
export { EXECUTABLE_TYPES, EXECUTABLE_TYPE_ORDER } from "./types.ts";
export { listUserExecutableGrants } from "./grants.ts";
export { listPendingExecutablePackages } from "./pending.ts";
