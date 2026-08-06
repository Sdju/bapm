import type { MarketplaceManifest, MarketplacePlugin } from "./models.ts";
import type { ValidationResult } from "./types.ts";

function validatePluginSchema(plugins: readonly MarketplacePlugin[]): ValidationResult {
  const errors: string[] = [];
  for (const plugin of plugins) {
    if (!plugin.name || !plugin.name.trim()) {
      errors.push("Plugin entry has empty name");
    }
    if (plugin.source === null || plugin.source === undefined) {
      errors.push(`Plugin '${plugin.name}' is missing required field 'source'`);
    }
  }
  return {
    checkName: "Schema",
    passed: errors.length === 0,
    warnings: [],
    errors,
  };
}

function validateNoDuplicateNames(plugins: readonly MarketplacePlugin[]): ValidationResult {
  const errors: string[] = [];
  const seen = new Map<string, string>();
  for (const plugin of plugins) {
    const lower = plugin.name.trim().toLowerCase();
    const prev = seen.get(lower);
    if (prev !== undefined) {
      errors.push(`Duplicate plugin name: '${plugin.name}' (conflicts with '${prev}')`);
    } else {
      seen.set(lower, plugin.name);
    }
  }
  return {
    checkName: "Names",
    passed: errors.length === 0,
    warnings: [],
    errors,
  };
}

/** Thin validate: schema (name+source) + case-insensitive duplicate names. */
export function validateMarketplace(manifest: MarketplaceManifest): ValidationResult[] {
  const plugins = manifest.plugins ?? [];
  return [validatePluginSchema(plugins), validateNoDuplicateNames(plugins)];
}
