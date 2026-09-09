/**
 * Expand structured `active` (+ nested preset `active`) into preset/target ids.
 */
import { ManifestError } from "./errors.ts";
import type { ActiveEntry, BapmManifest, ManifestPreset, ResolvedActive } from "./types.ts";

function indexPresets(presets: ManifestPreset[] | undefined): Map<string, ManifestPreset> {
  const map = new Map<string, ManifestPreset>();
  if (!presets) return map;
  for (const p of presets) {
    map.set(p.name, p);
  }
  return map;
}

function walkActive(
  entries: ActiveEntry[] | undefined,
  presets: Map<string, ManifestPreset>,
  stack: string[],
  includedPresets: Set<string>,
  excludedPresets: Set<string>,
  includedTargets: Set<string>,
  excludedTargets: Set<string>,
  presetOrder: string[],
  targetOrder: string[],
): void {
  if (!entries) return;

  for (const entry of entries) {
    if (entry.kind === "preset") {
      if (entry.negate) {
        excludedPresets.add(entry.id);
        continue;
      }
      if (!presets.has(entry.id)) {
        throw new ManifestError(
          "MANIFEST_VALIDATION",
          `Unknown included preset "${entry.id}" (no matching presets[].name)`,
          { path: "active", details: { preset: entry.id } },
        );
      }
      if (stack.includes(entry.id)) {
        const cycle = [...stack, entry.id].join(" -> ");
        throw new ManifestError(
          "MANIFEST_VALIDATION",
          `Circular preset active chain detected (cycle): ${cycle}`,
          { path: "active", details: { cycle: [...stack, entry.id] } },
        );
      }
      if (!includedPresets.has(entry.id)) {
        includedPresets.add(entry.id);
        presetOrder.push(entry.id);
      }
      const nested = presets.get(entry.id)?.active;
      walkActive(
        nested,
        presets,
        [...stack, entry.id],
        includedPresets,
        excludedPresets,
        includedTargets,
        excludedTargets,
        presetOrder,
        targetOrder,
      );
      continue;
    }

    // target
    if (entry.negate) {
      excludedTargets.add(entry.id);
      continue;
    }
    if (!includedTargets.has(entry.id)) {
      includedTargets.add(entry.id);
      targetOrder.push(entry.id);
    }
  }
}

/**
 * Pure expansion: walk top-level (and nested preset) `active` with cycle detection.
 * Excludes win over includes. Omitted `active` → empty sets.
 */
export function resolveActive(doc: BapmManifest | Record<string, unknown>): ResolvedActive {
  const manifest = doc as BapmManifest;
  const presets = indexPresets(manifest.presets);
  const includedPresets = new Set<string>();
  const excludedPresets = new Set<string>();
  const includedTargets = new Set<string>();
  const excludedTargets = new Set<string>();
  const presetOrder: string[] = [];
  const targetOrder: string[] = [];

  walkActive(
    manifest.active,
    presets,
    [],
    includedPresets,
    excludedPresets,
    includedTargets,
    excludedTargets,
    presetOrder,
    targetOrder,
  );

  return {
    presetIds: presetOrder.filter((id) => !excludedPresets.has(id)),
    targetIds: targetOrder.filter((id) => !excludedTargets.has(id)),
  };
}

/** Aliases for acceptance helper pickExport. */
export const expandActive = resolveActive;
export const resolveManifestActive = resolveActive;
export const resolveActiveSelection = resolveActive;
