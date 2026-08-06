import type { RenderMarketplaceBlockOptions } from "./types.ts";

/**
 * Render a `marketplace:` YAML block template (~APM render_marketplace_block).
 * Does not write host marketplace.json artifacts.
 */
export function renderMarketplaceBlock(options: RenderMarketplaceBlockOptions = {}): string {
  const owner = options.owner?.trim() || "acme-org";
  // name is accepted for callers that pass project name; block inherits top-level.
  void options.name;
  void options.cwd;

  return `\
# Marketplace authoring config (bapm).
# Pack host marketplace.json emit is deferred (future: bapm pack).
# Top-level 'name', 'description', and 'version' are inherited from
# the project (above) by default.
marketplace:
  owner: ${owner}

  # Default tag pattern used to resolve version ranges for each package.
  build:
    tagPattern: "v*"

  # Output targets (map form). 'claude' is enabled by default for forward-compat.
  # No host artifacts are written by authoring commands in this release.
  outputs:
    claude: true

  packages:
    - name: example-package
      description: Human-readable description of the package
      source: ${owner}/example-package
      version: "^1.0.0"
`;
}

/** Alias used by some call sites / acceptance soft-resolve. */
export const renderInitMarketplaceBlock = renderMarketplaceBlock;
export const createMarketplaceAuthoringTemplate = renderMarketplaceBlock;
