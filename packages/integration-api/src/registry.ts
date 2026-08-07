import type {
  BapmIntegration,
  MarketplaceOutputIntegration,
  MarketplaceOutputRegistry,
  TargetId,
  IntegrationRegistry,
} from "./types.ts";

/**
 * Create an empty in-memory target registry for core Install and tests.
 * No concrete host imports — callers register doubles or host packages.
 */
export function createIntegrationRegistry(): IntegrationRegistry {
  const byId = new Map<TargetId, BapmIntegration>();

  return {
    register(target: BapmIntegration): void {
      if (!target || typeof target !== "object") {
        throw new TypeError("register requires a BapmIntegration object");
      }
      const id = String(target.id ?? "").trim();
      if (!id) {
        throw new TypeError("BapmIntegration.id is required");
      }
      if (!Array.isArray(target.deployRoots)) {
        throw new TypeError(`BapmIntegration ${id} requires deployRoots array`);
      }
      if (typeof target.detect !== "function") {
        throw new TypeError(`BapmIntegration ${id} requires detect()`);
      }
      if (typeof target.materialize !== "function") {
        throw new TypeError(`BapmIntegration ${id} requires materialize()`);
      }
      byId.set(id, target.id === id ? target : { ...target, id });
    },

    list(): BapmIntegration[] {
      return [...byId.values()];
    },

    get(id: TargetId): BapmIntegration | undefined {
      return byId.get(id);
    },

    getAll(): BapmIntegration[] {
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
