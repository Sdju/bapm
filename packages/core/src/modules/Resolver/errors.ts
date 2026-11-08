export type ResolverErrorCode =
  | "RESOLVE_NEST_REFUSED"
  | "RESOLVE_DEPTH_EXCEEDED"
  | "RESOLVE_CYCLE"
  | "RESOLVE_EMPTY_INTERSECTION"
  | "RESOLVE_IMMUTABLE_CONFLICT"
  | "RESOLVE_REGISTRY_DEFERRED"
  | "RESOLVE_NO_MATCHING_TAG"
  | "RESOLVE_VIRTUAL_PATH_INVALID"
  | "RESOLVE_FAILED"
  | "LOCAL_PATH_ESCAPES_PROJECT_ROOT"
  | "LOCAL_ROOT_TRACKED"
  | "DOWNLOAD_FAILED"
  | "CLASSIFY_INVALID";

export class ResolverError extends Error {
  readonly code: ResolverErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ResolverErrorCode,
    message: string,
    options?: { details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "ResolverError";
    this.code = code;
    this.details = options?.details;
  }
}
