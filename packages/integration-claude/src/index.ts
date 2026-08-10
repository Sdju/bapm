/**
 * @b-apm/integration-claude — Claude Code runtime + marketplace pack mapper.
 */

export {
  createClaudeIntegration,
  createClaudeIntegration as createIntegration,
  transformClaudeRulesMarkdown,
} from "./createClaudeIntegration.ts";

import type { MarketplaceOutputIntegration } from "@b-apm/integration-api";

type PackageEntry = Record<string, unknown>;
type ResolvedPackage = Record<string, unknown> & { entry: PackageEntry };

function ownerObject(config: Record<string, unknown>): Record<string, string> {
  const owner = config.owner;
  if (!owner) return { name: "unknown" };
  if (typeof owner === "string") return { name: owner };
  const value = owner as { name: string; email?: string; url?: string };
  return {
    name: value.name,
    ...(value.email ? { email: value.email } : {}),
    ...(value.url ? { url: value.url } : {}),
  };
}

/** Maps resolved packages into Anthropic's marketplace document. */
export function mapClaudeMarketplace(
  config: unknown,
  resolved: unknown[],
): Record<string, unknown> {
  const cfg = config as Record<string, unknown>;
  const plugins = (resolved as ResolvedPackage[]).map((pkg) => {
    const entry = pkg.entry;
    const plugin: Record<string, unknown> = { name: pkg.name };
    for (const key of ["description", "author", "license", "repository", "category"] as const) {
      if (entry[key]) plugin[key] = entry[key];
    }
    if (typeof entry.version === "string" && !/[\^~><=* ]/.test(entry.version)) {
      plugin.version = entry.version;
    }
    if (Array.isArray(pkg.tags) && pkg.tags.length) plugin.tags = pkg.tags;
    if (pkg.isLocal) plugin.source = pkg.source;
    else if (pkg.subdir) {
      plugin.source = {
        source: "git-subdir",
        url: pkg.sourceUrl ?? pkg.sourceRepo,
        path: pkg.subdir,
        ...(pkg.ref ? { ref: pkg.ref } : {}),
        ...(pkg.sha ? { sha: pkg.sha } : {}),
      };
    } else {
      plugin.source = { source: "url", url: pkg.sourceUrl ?? pkg.sourceRepo };
    }
    return plugin;
  });
  return {
    name: cfg.name ?? "marketplace",
    ...(cfg.description ? { description: cfg.description } : {}),
    ...(cfg.version ? { version: cfg.version } : {}),
    owner: ownerObject(cfg),
    ...(cfg.metadata ? { metadata: cfg.metadata } : {}),
    plugins,
  };
}

export const claudeMarketplaceIntegration: MarketplaceOutputIntegration = {
  id: "claude",
  marketplaceOutput: {
    format: "claude",
    defaultOutput: ".claude-plugin/marketplace.json",
    map: mapClaudeMarketplace,
  },
};
