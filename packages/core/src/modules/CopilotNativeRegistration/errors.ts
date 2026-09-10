export type CopilotNativeRegistrationErrorCode =
  | "COPILOT_NATIVE_SETTINGS_INVALID"
  | "COPILOT_NATIVE_MARKETPLACE_COLLISION"
  | "COPILOT_NATIVE_PLUGIN_COLLISION"
  | "COPILOT_NATIVE_ADMISSION_INVALID"
  | "COPILOT_NATIVE_FAILED";

export class CopilotNativeRegistrationError extends Error {
  readonly code: CopilotNativeRegistrationErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: CopilotNativeRegistrationErrorCode,
    message: string,
    options?: { details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "CopilotNativeRegistrationError";
    this.code = code;
    this.details = options?.details;
  }
}
