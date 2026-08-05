import type { LockedDependency, LockfileDocument, LockfileInput } from "@/modules/Lockfile";

/** Supported SBOM format identifiers (case-insensitive). */
export const FORMAT_CYCLONEDX = "cyclonedx";
export const FORMAT_SPDX = "spdx";
export const SUPPORTED_FORMATS = [FORMAT_CYCLONEDX, FORMAT_SPDX] as const;
export type SbomFormat = (typeof SUPPORTED_FORMATS)[number];

export const CYCLONEDX_SPEC_VERSION = "1.5";
export const SPDX_VERSION = "SPDX-2.3";
export const FIXED_EPOCH_TIMESTAMP = "1970-01-01T00:00:00Z";

export type ExportSbomOptions = {
  /** In-memory lock document; when omitted, load from `cwd`. */
  document?: LockfileDocument | LockfileInput | Record<string, unknown>;
  /** Project root for lock discovery when `document` is omitted. */
  cwd?: string;
  /** `cyclonedx` (default) or `spdx`. */
  format?: string;
  /** Explicit ISO timestamp (wins over SOURCE_DATE_EPOCH / generated_at). */
  timestamp?: string;
};

export type ExportSbomSuccess = {
  ok: true;
  json: string;
  format: SbomFormat;
};

export type ExportSbomFailure = {
  ok: false;
  error: string;
};

export type ExportSbomResult = ExportSbomSuccess | ExportSbomFailure;

export type InventoryDep = LockedDependency & {
  declared_license?: string;
  content_hash?: string;
  host_type?: string;
};

export type { LockedDependency, LockfileDocument, LockfileInput };
