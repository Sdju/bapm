/**
 * Install — orchestrate resolve/download, primitives, target materialize, lock write.
 *
 * ## Public API
 *
 * - `runInstall` / `installProject` — primary install entry
 * - `enforceFrozen` — basic lk-006 gate
 * - `isCiEnvTruthy` / `resolveEffectiveFrozen` — OpenAPM lk-018 CI-default frozen
 * - `declaredTargetIds` / `declaredTargetIntegrationMap` — tg-008 declared hosts + map hint
 * - Deployed inventory helpers (hash verify / orphan cleanup) for Audit / Uninstall
 * - Types / `InstallError`
 *
 * Target interaction is only via `@b-apm/integration-api` (no concrete host imports).
 * Deployed inventory uses SHA-256 of file bytes (see `deployedInventory.ts`).
 */

export type {
  EnforceFrozenOptions,
  InstallOnlyMode,
  InstallOptions,
  InstallResult,
  RunInstallOptions,
} from "./types.ts";

export type { InstallErrorCode } from "./errors.ts";
export { InstallError } from "./errors.ts";

export { enforceFrozen } from "./frozen.ts";
export {
  isCiEnvTruthy,
  resolveEffectiveFrozen,
  type ResolveEffectiveFrozenOptions,
} from "./ciFrozen.ts";
export { runInstall, installProject } from "./runInstall.ts";
export { declaredTargetIds, declaredTargetIntegrationMap } from "./targets.ts";
export {
  DEPLOYED_HASH_ALGO,
  hashFileBytes,
  hashFileAt,
  safeResolveUnderCwd,
  cleanupOrphanDeployedFiles,
  verifyDeployedFileHashes,
  collectDeployedHashViolations,
  collectDeployedHashes,
  applyDeployedHashesToLock,
} from "./deployedInventory.ts";
export type { DeployedHashViolation, ResolvedDeployedFile } from "./deployedInventory.ts";
