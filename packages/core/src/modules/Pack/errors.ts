/** Typed diagnostics for pack / extract / release-gate. */

export type PackErrorCode =
  | "PACK_VALIDATION"
  | "PACK_SECRET_REFUSED"
  | "PACK_IO"
  | "PACK_EXTRACT"
  | "RELEASE_TAG_MISSING"
  | "RELEASE_TAG_INVALID"
  | "RELEASE_TAG_MISMATCH";

export class PackError extends Error {
  readonly code: PackErrorCode;
  readonly path?: string;
  readonly details?: Record<string, unknown>;

  constructor(
    code: PackErrorCode,
    message: string,
    options?: { path?: string; details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "PackError";
    this.code = code;
    this.path = options?.path;
    this.details = options?.details;
  }
}
