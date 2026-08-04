import type { BapmTarget, TargetId, TargetRegistry } from "./types.ts";

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
  };
}

/** Alias preferred by some callers / docs. */
export const createRegistry = createTargetRegistry;
