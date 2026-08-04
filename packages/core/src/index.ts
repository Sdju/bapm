/**
 * @bapm/core — domain library for Better Agent Package Manager.
 *
 * Layered surface (mirrors microsoft/apm responsibilities, clearer TS boundaries):
 * - manifest  — parse/validate apm.yml / bapm.yml
 * - lockfile  — read/write lock with integrity pins
 * - resolver  — transitive dependency resolution
 * - primitives — skills, prompts, agents, hooks, plugins, MCP
 * - install   — materialize resolved tree into the workspace
 *
 * Host targets are NOT in-core adapters (unlike APM adapters/client/).
 * Deploy goes through bapm-target-api + bapm-target-* packages (planned).
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
} from "./manifest/types.ts";

export type { ManifestErrorCode, ManifestWarning } from "./manifest/errors.ts";
export { ManifestError } from "./manifest/errors.ts";

export {
  APM_MANIFEST_FILE,
  BAPM_MANIFEST_FILE,
  discoverManifestPath,
} from "./manifest/discover.ts";
export { loadManifest } from "./manifest/load.ts";
export { parseManifest, parseManifestDocument } from "./manifest/parse.ts";
export { loadYamlDocument } from "./manifest/yaml-load.ts";

export const BAPM_NAME = "bapm";
export const BAPM_LOCK_FILE = "bapm.lock.yaml";

export function getVersion(): string {
  return "0.0.0";
}
