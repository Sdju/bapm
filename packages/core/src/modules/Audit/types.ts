export type AuditCiFormat = "text" | "json" | "sarif";

export type RunAuditCiOptions = {
  cwd?: string;
  ci?: boolean;
  /** When set, `body` is the serialized document and `text` mirrors it for json/sarif. */
  format?: AuditCiFormat;
};

export type AuditCiCheckName = "lockfile-exists" | "content-integrity" | "tree-sha256";

export type AuditCiCheck = {
  name: AuditCiCheckName;
  passed: boolean;
  message: string;
  details: string[];
  /**
   * Project-relative URIs aligned with `details` (or a single fallback) for SARIF.
   * Omitted from JSON serialization.
   */
  locations?: string[];
};

export type AuditCiSummary = {
  total: number;
  passed: number;
  failed: number;
};

export type AuditCiStructuredReport = {
  passed: boolean;
  checks: AuditCiCheck[];
  summary: AuditCiSummary;
};

export type AuditCiResult = {
  ok: boolean;
  exitCode: number;
  violations: string[];
  diagnostics: string[];
  text: string;
  checks: AuditCiCheck[];
  /** Same as overall gate: true iff every check passed. */
  passed: boolean;
  summary: AuditCiSummary;
  /** Relative lock path when discovered (SARIF fallback uri). */
  lockRelativePath?: string;
  /** Serialized body when `format` was json/sarif. */
  body?: string;
};
