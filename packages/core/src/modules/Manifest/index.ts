/**
 * Manifest — discover / load / parse apm.yml & bapm.yml (OpenAPM-compatible).
 *
 * ## Public API
 *
 * - Types: `BapmManifest`, `BapmDependency`, `DependencyEntry`, `DependencyLists`,
 *   `DiscoverManifestOptions`, `DiscoveredManifest`, `LoadManifestOptions`,
 *   `LoadManifestResult`, `ManifestFilename`, `ObjectDependency`, `RegistryEntry`,
 *   `ManifestErrorCode`, `ManifestWarning`
 * - Errors: `ManifestError`
 * - Constants: `APM_MANIFEST_FILE`, `BAPM_MANIFEST_FILE`
 * - Functions: `discoverManifestPath`, `loadManifest`, `parseManifest`,
 *   `parseManifestDocument`, `loadYamlDocument`
 *
 * ## Example
 *
 * ```ts
 * import { loadManifest } from "@/modules/Manifest";
 * const { document } = loadManifest({ cwd: process.cwd() });
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
