/**
 * Marketplace VersionCheck — local package version source + strategy alignment gate.
 * Distinct from Pack `checkReleaseTag` (pr-004 tag↔root manifest).
 */

export type {
  PackageVersionRow,
  VersionAlignmentReport,
  CheckVersionAlignmentOptions,
  LocalVersionStatus,
  LocalVersionRead,
} from "./types.ts";

export { findPluginJson, PLUGIN_JSON_CANDIDATES } from "./findPluginJson.ts";
export { renderTag } from "./renderTag.ts";
export { readLocalVersion, MAX_PLUGIN_JSON_BYTES } from "./readLocalVersion.ts";
export {
  checkVersionAlignment,
  checkMarketplaceVersionAlignment,
  runVersionAlignmentCheck,
  checkVersions,
  versionAlignmentErrorMessages,
} from "./checkVersionAlignment.ts";
