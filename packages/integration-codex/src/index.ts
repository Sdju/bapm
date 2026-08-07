import type { MarketplaceOutputIntegration } from "@bapm/integration-api";

type PackageEntry = Record<string, unknown>;
type ResolvedPackage = Record<string, unknown> & { entry: PackageEntry };

/** Maps resolved packages into Codex's marketplace document. */
export function mapCodexMarketplace(config: unknown, resolved: unknown[]): Record<string, unknown> {
  const cfg = config as Record<string, unknown>;
  const plugins = (resolved as ResolvedPackage[]).map((pkg) => {
    const category = pkg.entry.category;
    if (!category) {
      throw new TypeError(
        `package '${pkg.entry.name}' is missing category required for Codex output`,
      );
    }
    return {
      name: pkg.name,
      source: pkg.isLocal
        ? { source: "local", path: pkg.source }
        : { source: "url", url: pkg.sourceUrl ?? pkg.sourceRepo },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      category,
    };
  });
  return {
    name: cfg.name ?? "marketplace",
    interface: { displayName: cfg.name ?? (typeof cfg.owner === "string" ? cfg.owner : "unknown") },
    plugins,
  };
}

export const codexMarketplaceIntegration: MarketplaceOutputIntegration = {
  id: "codex",
  marketplaceOutput: {
    format: "codex",
    defaultOutput: ".agents/plugins/marketplace.json",
    map: mapCodexMarketplace,
  },
};
