/** Neutral YAML diagnostics for the common layer (no Manifest/Lockfile types). */

export type YamlErrorCode = "YAML_PARSE" | "YAML_SAFE_SUBSET";

export class YamlError extends Error {
  readonly code: YamlErrorCode;
  readonly path?: string;
  readonly details?: Record<string, unknown>;

  constructor(
    code: YamlErrorCode,
    message: string,
    options?: { path?: string; details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "YamlError";
    this.code = code;
    this.path = options?.path;
    this.details = options?.details;
  }
}
