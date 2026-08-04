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
  WriteProducerManifestOptions,
  WriteProducerManifestResult,
  CreateMinimalManifestOptions,
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
  writeProducerManifest,
  emitManifest,
  writeManifestValidated,
  createMinimalManifest,
  createMinimalManifestDocument,
  CANONICAL_TARGET_TOKENS,
  TARGET_ALIAS_TOKENS,
  VENDOR_TARGET_RE,
  isValidTargetToken,
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
  TreeSha256Violation,
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
  computeCanonicalTreeSha256,
  treeSha256Equal,
  formatTreeSha256Violation,
  isGitSourcedLockEntry,
  locateGitPackageTree,
  collectTreeSha256Violations,
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
  materializeRegistryNodes,
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
  isCiEnvTruthy,
  resolveEffectiveFrozen,
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

export type { ResolveEffectiveFrozenOptions } from "@/modules/Install";

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

export type {
  RunPackOptions,
  RunPackResult,
  ExtractPackArchiveOptions,
  ExtractPackArchiveResult,
  CheckReleaseTagOptions,
  CheckReleaseTagResult,
  PackErrorCode,
} from "@/modules/Pack";

export {
  PackError,
  runPack,
  packProject,
  packArchive,
  extractPackArchive,
  unpackArchive,
  extractPack,
  checkReleaseTag,
  checkRelease,
  runCheckRelease,
  isSecretPackPath,
  describeSecretRefuse,
} from "@/modules/Pack";

export type {
  DiscoverPolicyOptions,
  DiscoveredPolicy,
  EvaluatePolicyOptions,
  EvaluatePolicyResult,
  LoadPolicyOptions,
  LoadPolicyResult,
  ParsePolicyResult,
  PolicyCandidate,
  PolicyDependencies,
  PolicyDependencyInput,
  PolicyDocument,
  PolicyEnforcement,
  PolicyGateOptions,
  PolicyGateResult,
  PolicyViolation,
  PolicyErrorCode,
  PolicyWarning,
} from "@/modules/Policy";

export {
  PolicyError,
  APM_POLICY_FILE,
  BAPM_POLICY_FILE,
  DEFAULT_POLICY_PROVIDERS,
  POLICY_DISCOVERY_PROVIDERS,
  defaultPolicyProviders,
  discoverPolicyPath,
  discoverLocalPolicyPath,
  loadPolicy,
  parsePolicy,
  parsePolicyDocument,
  evaluateInstallPolicy,
  evaluatePolicy,
  evaluatePolicyRules,
  isPolicyDisabled,
  runPolicyGate,
  assertPolicyGateAllows,
} from "@/modules/Policy";

export type {
  ExecutableGrantEntry,
  ExecutableGrantSurface,
  ExecutableTrustDecision,
  ExecutableTrustOutcome,
  EvaluateExecutableTrustOptions,
  ParseExecutableGrantsOptions,
} from "@/modules/ExecutableTrust";

export {
  evaluateExecutableTrust,
  evaluateMcpExecutableTrust,
  gateExecutableMcp,
  checkExecutableTrust,
  hasGrantSurface,
  parseExecutableGrants,
} from "@/modules/ExecutableTrust";

export type {
  CollectedMcpServer,
  CollectMcpServersOptions,
  CollectMcpServersResult,
  ApplyMcpInventoryOptions,
} from "@/modules/Mcp";

export { collectMcpServers, applyMcpInventoryToLock } from "@/modules/Mcp";

export type { CompileAgentsMdOptions, CompileAgentsMdResult } from "@/modules/Compile";

export { compileAgentsMd, compileProject, runCompile, emitAgentsMd } from "@/modules/Compile";

export type {
  CacheCleanOptions,
  CacheCleanResult,
  CacheInfoOptions,
  CacheInfoResult,
} from "@/modules/Cache";

export {
  cacheInfo,
  getCacheInfo,
  modulesCacheInfo,
  cacheClean,
  cleanModulesCache,
} from "@/modules/Cache";

export type {
  BuildPublishArchiveOptions,
  BuildPublishArchiveResult,
  CheckSelfUpdateOptions,
  CheckSelfUpdateResult,
  CreateRegistryClientOptions,
  RegistryClient,
  RegistryHttpRequest,
  RegistryHttpResponse,
  RegistryHttpTransport,
  RegistryVersionInfo,
  RegistryErrorCode,
} from "@/modules/Registry";

export {
  RegistryError,
  EXPERIMENTAL_REGISTRIES_ENV,
  isExperimentalRegistriesEnabled,
  experimentalRegistriesRemediation,
  assertExperimentalRegistriesEnabled,
  createRegistryClient,
  createRegistryHttpClient,
  createPackageRegistryClient,
  sha256Digest,
  sha256Hex,
  digestsEqual,
  verifyArchiveDigest,
  createFetchTransport,
  resolveRegistryToken,
  buildPublishArchive,
  createPublishArchive,
  packPublishArchive,
  buildRegistryPublishZip,
  checkSelfUpdate,
  compareSelfUpdate,
  runSelfUpdateCheck,
  fetchLatestCliVersion,
  resolveRegistryBaseUrl,
  parsePackageId,
  registryRepoUrl,
  downloadUrl,
  pickRegistryVersion,
  materializeRegistryArchive,
  fetchAndMaterializeRegistry,
  rewriteDownloadBase,
  modulesRegistryDest,
} from "@/modules/Registry";

export const BAPM_NAME = "bapm";

export function getVersion(): string {
  return "0.0.0";
}
