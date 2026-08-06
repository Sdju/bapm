import { MarketplaceError } from "../../errors.ts";

/** Marketplace pack-outputs / builder errors (fail-closed emit). */
export class MarketplacePackOutputsError extends MarketplaceError {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "MarketplacePackOutputsError";
    this.exitCode = exitCode;
  }
}
