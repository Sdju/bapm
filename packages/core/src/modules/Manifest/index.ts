/**
 * Manifest — discover / load / parse apm.yml & bapm.yml (OpenAPM-compatible).
 *
 * ## Public API
 *
 * - Types: `BapmManifest`, `ActiveEntry`, `ManifestPreset`, `ResolvedActive`, …
 * - Functions: `parseManifestDocument`, `resolveActive`, `effectiveDirectDeps`, …
 *
 * ## Example
 *
 * ```ts
 * import { loadEffectiveManifest, resolveActive, createMinimalManifest } from "@/modules/Manifest";
 * const { document, localPath } = loadEffectiveManifest({ cwd: process.cwd() });
 * const { presetIds, targetIds } = resolveActive(document);
 * ```
 */
export type {
  ActiveEntry,
  BapmManifest,
  BapmDependency,
  DependencyEntry,
  DependencyLists,
  DiscoverManifestOptions,
  DiscoveredManifest,
  LoadManifestOptions,
  LoadManifestResult,
  ManifestFilename,
  ManifestPreset,
  ObjectDependency,
  RegistryEntry,
  ResolvedActive,
  TargetIntegrationMap,
} from "./types.ts";

export type { ManifestErrorCode, ManifestWarning } from "./errors.ts";
export { ManifestError } from "./errors.ts";

export { APM_MANIFEST_FILE, BAPM_MANIFEST_FILE, discoverManifestPath } from "./discover.ts";
export { loadBaseManifest, loadManifest, loadEffectiveManifest } from "./load.ts";
export {
  APM_LOCAL_MANIFEST_FILE,
  BAPM_LOCAL_MANIFEST_FILE,
  assertNoApmLocalOverlay,
  loadLocalOverlayIfPresent,
  mergeLocalOverlay,
  parseLocalOverlayDocument,
  overlayRootForBase,
} from "./localOverlay.ts";
export type { LocalOverlayFields } from "./localOverlay.ts";
export { parseManifest, parseManifestDocument, validateManifestEnv } from "./parse.ts";
export { parseDepSkillSubset, parseDepTargetSubset, applyDepSubsetFields } from "./depSubset.ts";
export {
  mergeApmDependencyUpdate,
  isRegistrySourced,
  isGitShaped,
  entryIdentity,
  registryOrPackageIdentity,
} from "./mergeApmDependency.ts";
export { parseActiveField, activeEntriesToEmitShape } from "./active.ts";
export { parsePresetsField } from "./presets.ts";
export {
  resolveActive,
  expandActive,
  resolveManifestActive,
  resolveActiveSelection,
} from "./resolveActive.ts";
export {
  effectiveDirectDeps,
  effectiveManifestDeps,
  unionPresetDependencies,
  withEffectiveDirectDeps,
} from "./effectiveDirectDeps.ts";
export type { EffectiveDirectDeps } from "./effectiveDirectDeps.ts";
export { loadYamlDocument } from "./yaml-load.ts";
export {
  serializeManifest,
  writeManifest,
  writeProducerManifest,
  emitManifest,
  writeManifestValidated,
} from "./write.ts";
export type {
  WriteManifestOptions,
  WriteProducerManifestOptions,
  WriteProducerManifestResult,
} from "./write.ts";
export { createMinimalManifest, createMinimalManifestDocument } from "./createMinimal.ts";
export type { CreateMinimalManifestOptions } from "./createMinimal.ts";
export {
  validatePluginName,
  validateProjectName,
  isValidPluginName,
  isValidProjectName,
} from "./pluginNames.ts";
export {
  createPluginJson,
  createPluginJsonDocument,
  buildPluginJson,
  serializePluginJson,
  writePluginJson,
  writePluginJsonFile,
  emitPluginJson,
} from "./pluginJson.ts";
export type {
  CreatePluginJsonOptions,
  PluginJsonAuthor,
  PluginJsonDocument,
  WritePluginJsonOptions,
} from "./pluginJson.ts";
export {
  CANONICAL_TARGET_TOKENS,
  TARGET_ALIAS_TOKENS,
  VENDOR_TARGET_RE,
  isValidTargetToken,
} from "./targets.ts";
export { isExemptInsecureHost } from "./registryUrl.ts";
