export type PrimitivesErrorCode = "PRIMITIVES_DISCOVER_FAILED" | "PRIMITIVES_CONFLICT";

export class PrimitivesError extends Error {
  readonly code: PrimitivesErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: PrimitivesErrorCode,
    message: string,
    options?: { details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "PrimitivesError";
    this.code = code;
    this.details = options?.details;
  }
}
