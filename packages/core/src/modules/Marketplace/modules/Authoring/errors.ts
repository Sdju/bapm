import { MarketplaceError } from "../../errors.ts";

/** Authoring schema / editor / detect / migrate errors. */
export class MarketplaceAuthoringError extends MarketplaceError {
  readonly exitCode: number;

  constructor(message: string, exitCode = 2) {
    super(message);
    this.name = "MarketplaceAuthoringError";
    this.exitCode = exitCode;
  }
}
