import type { BapmManifest } from "@/modules/Manifest";

/**
 * Surface declared target id(s) from a manifest for Install intersection (tg-008).
 * Accepts vendor ids `x-<vendor>-<name>` without requiring a registered impl (tg-004).
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
  if (Array.isArray(raw.targets)) {
    return raw.targets.map((t) => String(t).trim()).filter(Boolean);
  }
  return [];
}
