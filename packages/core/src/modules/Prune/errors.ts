export type PruneErrorCode = "PRUNE_FAILED";

export class PruneError extends Error {
  readonly code: PruneErrorCode;
  constructor(code: PruneErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "PruneError";
    this.code = code;
  }
}
