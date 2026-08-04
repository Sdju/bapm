export type UninstallErrorCode = "UNINSTALL_UNKNOWN" | "UNINSTALL_NO_PACKAGES" | "UNINSTALL_FAILED";

export class UninstallError extends Error {
  readonly code: UninstallErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: UninstallErrorCode,
    message: string,
    options?: { details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "UninstallError";
    this.code = code;
    this.details = options?.details;
  }
}
