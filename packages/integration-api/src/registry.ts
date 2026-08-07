import type {
  BapmTarget,
  MarketplaceOutputIntegration,
  MarketplaceOutputRegistry,
  TargetId,
  TargetRegistry,
} from "./types.ts";

/**
 * Create an empty in-memory target registry for core Install and tests.
 * No concrete host imports — callers register doubles or host packages.
 */
export function createTargetRegistry(): TargetRegistry {
  const byId = new Map<TargetId, BapmTarget>();

  return {
    register(target: BapmTarget): void {
      if (!target || typeof target !== "object") {
        throw new TypeError("register requires a BapmTarget object");
      }
      const id = String(target.id ?? "").trim();
      if (!id) {
        throw new TypeError("BapmTarget.id is required");
      }
      if (!Array.isArray(target.deployRoots)) {
        throw new TypeError(`BapmTarget ${id} requires deployRoots array`);
      }
      if (typeof target.detect !== "function") {
        throw new TypeError(`BapmTarget ${id} requires detect()`);
      }
      if (typeof target.materialize !== "function") {
        throw new TypeError(`BapmTarget ${id} requires materialize()`);
      }
      byId.set(id, { ...target, id });
    },

    list(): BapmTarget[] {
      return [...byId.values()];
    },

    get(id: TargetId): BapmTarget | undefined {
      return byId.get(id);
    },

    getAll(): BapmTarget[] {
      return [...byId.values()];
    },

    async detect(cwd: string) {
      const detectedIds: TargetId[] = [];
      const diagnostics: Array<{ targetId: TargetId; message: string }> = [];

      for (const target of byId.values()) {
        try {
          if (await target.detect({ cwd })) detectedIds.push(target.id);
        } catch {
          diagnostics.push({
            targetId: target.id,
            message: `Target "${target.id}" detection did not match`,
          });
        }
      }

      return { detectedIds, diagnostics };
    },
  };
}

/** Alias preferred by some callers / docs. */
export const createRegistry = createTargetRegistry;

/** Create a registry for marketplace-output-only or combined integrations. */
export function createMarketplaceOutputRegistry(): MarketplaceOutputRegistry {
  const byFormat = new Map<string, MarketplaceOutputIntegration>();

  return {
    register(integration): void {
      const format = integration?.marketplaceOutput?.format?.trim();
      if (!integration?.id?.trim() || !format || !integration.marketplaceOutput.defaultOutput) {
        throw new TypeError(
          "Marketplace output integration requires id, format, and defaultOutput",
        );
      }
      if (typeof integration.marketplaceOutput.map !== "function") {
        throw new TypeError(`Marketplace output integration ${integration.id} requires map()`);
      }
      byFormat.set(format, {
        ...integration,
        id: integration.id.trim(),
        marketplaceOutput: { ...integration.marketplaceOutput, format },
      });
    },
    list(): MarketplaceOutputIntegration[] {
      return [...byFormat.values()];
    },
    get(format: string): MarketplaceOutputIntegration | undefined {
      return byFormat.get(format);
    },
  };
}
