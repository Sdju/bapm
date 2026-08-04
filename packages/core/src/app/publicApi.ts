/**
 * Package public API assembly for @bapm/core.
 * Re-exports Manifest + Lockfile module surfaces and package-level constants.
 */

export type {
  BapmManifest,
  BapmDependency,
  DependencyEntry,
  DependencyLists,
  DiscoverManifestOptions,
  DiscoveredManifest,
  LoadManifestOptions,
  LoadManifestResult,
  ManifestFilename,
  ObjectDependency,
  RegistryEntry,
  ManifestErrorCode,
  ManifestWarning,
} from "@/modules/Manifest";

export {
  ManifestError,
  APM_MANIFEST_FILE,
  BAPM_MANIFEST_FILE,
  discoverManifestPath,
  loadManifest,
  parseManifest,
  parseManifestDocument,
  loadYamlDocument,
} from "@/modules/Manifest";

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
  LockfileErrorCode,
} from "@/modules/Lockfile";

export {
  LockfileError,
  APM_LOCK_FILE,
  BAPM_LOCK_FILE,
  discoverLockfilePath,
  loadLockfile,
  loadLockfileOrNull,
  writeLockfile,
  parseLockfile,
  parseLockfileDocument,
  serializeLockfile,
  isSemanticallyEquivalent,
} from "@/modules/Lockfile";

export const BAPM_NAME = "bapm";

export function getVersion(): string {
  return "0.0.0";
}
