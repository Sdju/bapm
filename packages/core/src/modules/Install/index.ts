/**
 * Install — orchestrate resolve/download, primitives, target materialize, lock write.
 *
 * ## Public API
 *
 * - `runInstall` / `installProject` — primary install entry
 * - `enforceFrozen` — basic lk-006 gate
 * - Types / `InstallError`
 *
 * Target interaction is only via `bapm-target-api` (no concrete host imports).
 */

export type {
  EnforceFrozenOptions,
  InstallOptions,
  InstallResult,
  RunInstallOptions,
} from "./types.ts";

export type { InstallErrorCode } from "./errors.ts";
export { InstallError } from "./errors.ts";

export { enforceFrozen } from "./frozen.ts";
export { runInstall, installProject } from "./runInstall.ts";
export { declaredTargetIds } from "./targets.ts";
