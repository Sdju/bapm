/** Typed diagnostics for manifest discovery / YAML load / validate. */

export type ManifestErrorCode =
  | "MANIFEST_NOT_FOUND"
  | "MANIFEST_DUAL_CONFLICT"
  | "MANIFEST_MISSING_FILE"
  | "MANIFEST_YAML_PARSE"
  | "MANIFEST_YAML_SAFE_SUBSET"
  | "MANIFEST_VALIDATION";

export class ManifestError extends Error {
  readonly code: ManifestErrorCode;
  readonly path?: string;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ManifestErrorCode,
    message: string,
    options?: { path?: string; details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "ManifestError";
    this.code = code;
    this.path = options?.path;
    this.details = options?.details;
  }
}

export type ManifestWarning = {
  code: string;
  message: string;
  path?: string;
};
