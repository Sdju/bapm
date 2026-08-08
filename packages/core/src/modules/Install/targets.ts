import type { BapmManifest, TargetIntegrationMap } from "@/modules/Manifest";

function isTargetIntegrationMap(value: unknown): value is TargetIntegrationMap {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Surface declared target id(s) from a manifest for Install intersection (tg-008).
 * Accepts vendor ids `x-<vendor>-<name>` without requiring a registered impl (tg-004).
 * Object-map forms contribute their keys (host ids); values are ignored here.
 */
export function declaredTargetIds(manifest: BapmManifest): string[] {
  const raw = manifest as Record<string, unknown>;
  if ("target" in raw && "targets" in raw) {
    // Mutual exclusion is enforced at parse; defensive here
    throw new Error('Manifest must not declare both "target" and "targets"');
  }
  if (typeof raw.target === "string" && raw.target.trim()) {
    return [raw.target.trim()];
  }
  if (isTargetIntegrationMap(raw.target)) {
    return Object.keys(raw.target);
  }
  if (Array.isArray(raw.targets)) {
    return raw.targets.map((t) => String(t).trim()).filter(Boolean);
  }
  if (isTargetIntegrationMap(raw.targets)) {
    return Object.keys(raw.targets);
  }
  return [];
}

/**
 * When `target` / `targets` used the object-map form, return the retained
 * host→package map. Legacy string/array forms → `undefined`.
 * CLI composition loads/registers these packages before install/compile selection.
 */
export function declaredTargetIntegrationMap(
  manifest: BapmManifest,
): Readonly<TargetIntegrationMap> | undefined {
  const raw = manifest as Record<string, unknown>;
  if (isTargetIntegrationMap(raw.target)) {
    return raw.target;
  }
  if (isTargetIntegrationMap(raw.targets)) {
    return raw.targets;
  }
  return undefined;
}
