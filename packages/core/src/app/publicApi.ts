/**
 * Package public API assembly for @bapm/core.
 * Re-exports Manifest + Lockfile + Resolver module surfaces and package-level constants.
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
  normalizeRepoIdentity,
  toLockRepoUrl,
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
} from "@/modules/Install";

export {
  InstallError,
  enforceFrozen,
  runInstall,
  installProject,
  declaredTargetIds,
} from "@/modules/Install";

export const BAPM_NAME = "bapm";

export function getVersion(): string {
  return "0.0.0";
}
