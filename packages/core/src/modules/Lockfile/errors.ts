/** Typed diagnostics for lockfile discovery / YAML load / validate / write. */

export type LockfileErrorCode =
  | "LOCKFILE_NOT_FOUND"
  | "LOCKFILE_DUAL_CONFLICT"
  | "LOCKFILE_MISSING_FILE"
  | "LOCKFILE_YAML_PARSE"
  | "LOCKFILE_YAML_SAFE_SUBSET"
  | "LOCKFILE_FORMAT"
  | "LOCKFILE_UNSUPPORTED_VERSION"
  | "LOCKFILE_VALIDATION";

export class LockfileError extends Error {
  readonly code: LockfileErrorCode;
  readonly path?: string;
  readonly details?: Record<string, unknown>;

  constructor(
    code: LockfileErrorCode,
    message: string,
    options?: { path?: string; details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "LockfileError";
    this.code = code;
    this.path = options?.path;
    this.details = options?.details;
  }
}
