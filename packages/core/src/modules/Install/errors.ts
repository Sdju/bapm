export type InstallErrorCode =
  | "INSTALL_FROZEN_NO_LOCK"
  | "INSTALL_FROZEN_MISSING_PIN"
  | "INSTALL_FROZEN_UPDATE_REJECTED"
  | "INSTALL_FROZEN_HASH_MISMATCH"
  | "INSTALL_FROZEN_POSITIONAL"
  | "INSTALL_UNKNOWN_TARGET"
  | "INSTALL_UNKNOWN_EXCLUDE"
  | "INSTALL_TARGET_FIELDS"
  | "INSTALL_ARCHIVE"
  | "INSTALL_PACKAGE_REF"
  | "INSTALL_MCP_TRUST"
  | "INSTALL_INSECURE"
  | "INSTALL_INVALID_HOST"
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
