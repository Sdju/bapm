/**
 * Manifest — discover / load / parse apm.yml & bapm.yml (OpenAPM-compatible).
 *
 * ## Public API
 *
 * - Types: `BapmManifest`, `BapmDependency`, `DependencyEntry`, `DependencyLists`,
 *   `DiscoverManifestOptions`, `DiscoveredManifest`, `LoadManifestOptions`,
 *   `LoadManifestResult`, `ManifestFilename`, `ObjectDependency`, `RegistryEntry`,
 *   `ManifestErrorCode`, `ManifestWarning`, `CreateMinimalManifestOptions`,
 *   `WriteProducerManifestOptions`, `WriteProducerManifestResult`
 * - Errors: `ManifestError`
 * - Constants: `APM_MANIFEST_FILE`, `BAPM_MANIFEST_FILE`
 * - Functions: `discoverManifestPath`, `loadManifest`, `parseManifest`,
 *   `parseManifestDocument`, `loadYamlDocument`, `serializeManifest`,
 *   `writeManifest`, `writeProducerManifest`, `createMinimalManifest`,
 *   `validatePluginName`, `validateProjectName`, `createPluginJson`,
 *   `writePluginJson`, `isValidTargetToken`
 *
 * ## Example
 *
 * ```ts
 * import { loadManifest, createMinimalManifest } from "@/modules/Manifest";
 * const { document } = loadManifest({ cwd: process.cwd() });
 * const scaffold = createMinimalManifest({ name: "my-pkg" });
 * ```
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
} from "./types.ts";

export type { ManifestErrorCode, ManifestWarning } from "./errors.ts";
export { ManifestError } from "./errors.ts";

export { APM_MANIFEST_FILE, BAPM_MANIFEST_FILE, discoverManifestPath } from "./discover.ts";
export { loadManifest } from "./load.ts";
export { parseManifest, parseManifestDocument } from "./parse.ts";
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
