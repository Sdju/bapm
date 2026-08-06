/** Marketplace-specific error hierarchy. */

export class MarketplaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketplaceError";
  }
}

export class MarketplaceNotFoundError extends MarketplaceError {
  readonly marketplaceName: string;

  constructor(marketplaceName: string, host = "github.com") {
    super(
      `Marketplace '${marketplaceName}' is not found. ` +
        `Run 'bapm marketplace add https://${host}/OWNER/REPO' ` +
        `or 'bapm marketplace add OWNER/REPO' to register it, ` +
        `or 'bapm marketplace list' to see registered marketplaces.`,
    );
    this.name = "MarketplaceNotFoundError";
    this.marketplaceName = marketplaceName;
  }
}

export class MarketplaceFetchError extends MarketplaceError {
  readonly marketplaceName: string;
  readonly reason: string;

  constructor(marketplaceName: string, reason = "") {
    const detail = reason ? `: ${reason}` : "";
    super(
      `Failed to fetch marketplace '${marketplaceName}'${detail}. ` +
        `Run 'bapm marketplace update ${marketplaceName}' to retry.`,
    );
    this.name = "MarketplaceFetchError";
    this.marketplaceName = marketplaceName;
    this.reason = reason;
  }
}
