/**
 * Package public API assembly for @bapm/core.
 * Re-exports Manifest + Lockfile + Resolver + Install + lifecycle module surfaces.
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
  WriteManifestOptions,
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
  serializeManifest,
  writeManifest,
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

export type {
  ClassifiedDependency,
  DependencyKind,
  DownloadArgs,
  DownloadPackageSpec,
  DownloadPackagesOptions,
  Downloader,
  FakeTag,
  GitRemote,
  ResolveAndLockOptions,
  ResolveAndLockResult,
  ResolveDependencyGraphOptions,
  ResolveGraphResult,
  ResolvePorts,
  ResolvedNode,
  TagLister,
  ResolverErrorCode,
  PurgeInstallPathArgs,
} from "@/modules/Resolver";

export {
  ResolverError,
  APM_MODULES_DIR,
  MAX_RESOLVE_DEPTH,
  DEFAULT_PARALLEL_DOWNLOADS,
  classifyDependencyRef,
  resolveDependencyGraph,
  downloadPackages,
  resolveAndLock,
  purgeModulesInstallPaths,
  normalizeRepoIdentity,
  toLockRepoUrl,
  identityToCacheDir,
  pickHighestSatisfyingTag,
  pickHighestInIntersection,
  pickTightestRange,
  createDefaultDownloader,
  createDefaultGitRemote,
  createDefaultTagLister,
} from "@/modules/Resolver";

export type {
  AttributedPrimitive,
  DiscoverPrimitivesOptions,
  PrimitiveConflictDiagnostic,
  PrimitiveSource,
  PrimitiveType,
  ResolvePrimitiveConflictsOptions,
  ResolvePrimitiveConflictsResult,
  PrimitivesErrorCode,
} from "@/modules/Primitives";

export {
  PrimitivesError,
  discoverPrimitives,
  resolvePrimitiveConflicts,
  resolveConflicts,
} from "@/modules/Primitives";

export type {
  EnforceFrozenOptions,
  InstallOptions,
  InstallResult,
  RunInstallOptions,
  InstallErrorCode,
  DeployedHashViolation,
  ResolvedDeployedFile,
} from "@/modules/Install";

export {
  InstallError,
  enforceFrozen,
  runInstall,
  installProject,
  declaredTargetIds,
  DEPLOYED_HASH_ALGO,
  hashFileBytes,
  hashFileAt,
  safeResolveUnderCwd,
  cleanupOrphanDeployedFiles,
  verifyDeployedFileHashes,
  collectDeployedHashViolations,
  collectDeployedHashes,
  applyDeployedHashesToLock,
} from "@/modules/Install";

export type {
  RunUpdateOptions,
  UpdatePlanEntry,
  UpdateResult,
  UpdateErrorCode,
} from "@/modules/Update";
export { UpdateError, runUpdate, updateProject } from "@/modules/Update";

export type {
  OutdatedRow,
  OutdatedResult,
  RunOutdatedOptions,
  OutdatedErrorCode,
} from "@/modules/Outdated";
export { OutdatedError, runOutdated, checkOutdated, outdated } from "@/modules/Outdated";

export type { RunUninstallOptions, UninstallResult, UninstallErrorCode } from "@/modules/Uninstall";
export { UninstallError, runUninstall, uninstallPackages, uninstall } from "@/modules/Uninstall";

export type { RunPruneOptions, PruneResult, PruneErrorCode } from "@/modules/Prune";
export { PruneError, runPrune, pruneModules, prune } from "@/modules/Prune";

export type { DepsListResult, DepsTreeResult, DepsWhyResult, RunDepsOptions } from "@/modules/Deps";
export {
  listDeps,
  depsList,
  runDepsList,
  treeDeps,
  depsTree,
  runDepsTree,
  whyDeps,
  depsWhy,
  runDepsWhy,
} from "@/modules/Deps";

export type { AuditCiResult, RunAuditCiOptions } from "@/modules/Audit";
export { runAuditCi, auditCi, runAudit } from "@/modules/Audit";

export type { DoctorResult, RunDoctorOptions, DoctorCheck } from "@/modules/Doctor";
export { runDoctor, doctor, checkDoctor } from "@/modules/Doctor";

export const BAPM_NAME = "bapm";

export function getVersion(): string {
  return "0.0.0";
}
