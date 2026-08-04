/** Typed diagnostics for policy discovery / YAML load / validate / gate. */

export type PolicyErrorCode =
  | "POLICY_NOT_FOUND"
  | "POLICY_DUAL_CONFLICT"
  | "POLICY_MISSING_FILE"
  | "POLICY_YAML_PARSE"
  | "POLICY_YAML_SAFE_SUBSET"
  | "POLICY_VALIDATION"
  | "POLICY_VIOLATION"
  | "POLICY_EXTENDS_CYCLE"
  | "POLICY_EXTENDS_DEPTH"
  | "POLICY_EXTENDS_FETCH"
  | "POLICY_HOST_CLASS_PIN"
  | "POLICY_REMOTE_AMBIGUOUS"
  | "POLICY_FETCH_FAILURE";

export class PolicyError extends Error {
  readonly code: PolicyErrorCode;
  readonly path?: string;
  readonly details?: Record<string, unknown>;

  constructor(
    code: PolicyErrorCode,
    message: string,
    options?: { path?: string; details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "PolicyError";
    this.code = code;
    this.path = options?.path;
    this.details = options?.details;
  }
}

export type PolicyWarning = {
  code: string;
  message: string;
  path?: string;
};
