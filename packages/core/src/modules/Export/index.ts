/**
 * Export — read-only SBOM inventory from lockfile fields (CycloneDX 1.5 / SPDX 2.3).
 *
 * Public surface mirrors APM `apm lock export` semantics without resolve/network.
 */

export type {
  ExportSbomFailure,
  ExportSbomOptions,
  ExportSbomResult,
  ExportSbomSuccess,
  InventoryDep,
  SbomFormat,
} from "./types.ts";

export {
  CYCLONEDX_SPEC_VERSION,
  FIXED_EPOCH_TIMESTAMP,
  FORMAT_CYCLONEDX,
  FORMAT_SPDX,
  SPDX_VERSION,
  SUPPORTED_FORMATS,
} from "./types.ts";

export { buildPurl, scrubUrl, componentName, componentVersion } from "./purl.ts";
export {
  classifyDeclaredLicense,
  KIND_EXPRESSION,
  KIND_ID,
  KIND_NAMED,
  type LicenseClass,
  type LicenseKind,
} from "./license.ts";
export { formatUnsupportedMessage, normalizeFormat, serializeSbom } from "./serialize.ts";
export { exportSbom } from "./exportSbom.ts";
