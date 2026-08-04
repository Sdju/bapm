export type OutdatedErrorCode = "OUTDATED_NO_LOCK" | "OUTDATED_FAILED";

export class OutdatedError extends Error {
  readonly code: OutdatedErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: OutdatedErrorCode,
    message: string,
    options?: { details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "OutdatedError";
    this.code = code;
    this.details = options?.details;
  }
}
