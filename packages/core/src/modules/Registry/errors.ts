export type RegistryErrorCode =
  | "REGISTRY_HTTP"
  | "REGISTRY_AUTH"
  | "REGISTRY_CONFLICT"
  | "REGISTRY_VALIDATION"
  | "REGISTRY_DIGEST"
  | "REGISTRY_GATE"
  | "REGISTRY_CONFIG"
  | "REGISTRY_PARSE"
  | "REGISTRY_PUBLISH"
  | "SELF_UPDATE";

export class RegistryError extends Error {
  readonly code: RegistryErrorCode;
  readonly details?: Record<string, unknown>;
  readonly status?: number;

  constructor(
    code: RegistryErrorCode,
    message: string,
    options?: { details?: Record<string, unknown>; cause?: unknown; status?: number },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "RegistryError";
    this.code = code;
    this.details = options?.details;
    this.status = options?.status;
  }
}
