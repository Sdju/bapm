export type InstallErrorCode =
  | "INSTALL_FROZEN_NO_LOCK"
  | "INSTALL_FROZEN_MISSING_PIN"
  | "INSTALL_FROZEN_UPDATE_REJECTED"
  | "INSTALL_TARGET_FIELDS"
  | "INSTALL_FAILED";

export class InstallError extends Error {
  readonly code: InstallErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: InstallErrorCode,
    message: string,
    options?: { details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "InstallError";
    this.code = code;
    this.details = options?.details;
  }
}
