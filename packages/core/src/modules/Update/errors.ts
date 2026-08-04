export type UpdateErrorCode = "UPDATE_FROZEN_REFUSED" | "UPDATE_CONFIRM_REQUIRED" | "UPDATE_FAILED";

export class UpdateError extends Error {
  readonly code: UpdateErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: UpdateErrorCode,
    message: string,
    options?: { details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "UpdateError";
    this.code = code;
    this.details = options?.details;
  }
}
