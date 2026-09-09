/**
 * Union base manifest deps with included preset dependency maps.
 */
import { ManifestError } from "./errors.ts";
import { resolveActive } from "./resolveActive.ts";
import type {
  BapmManifest,
  DependencyEntry,
  DependencyLists,
  ManifestPreset,
  ObjectDependency,
} from "./types.ts";

export type EffectiveDirectDeps = {
  dependencies?: DependencyLists;
  devDependencies?: DependencyLists;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Stable key for conflict detection (prefer explicit name). */
export function dependencyConflictKey(entry: DependencyEntry): string {
  if (typeof entry === "string") return `spec:${entry}`;
  if (entry && typeof entry === "object") {
    const o = entry as ObjectDependency & { spec?: string };
    if (typeof o.name === "string" && o.name.trim()) return `name:${o.name.trim()}`;
    if (typeof o.alias === "string" && o.alias.trim()) return `alias:${o.alias.trim()}`;
    if (typeof o.id === "string" && o.id.trim()) return `id:${o.id.trim()}`;
    if (typeof o.git === "string") return `git:${o.git}${o.path ? `#${o.path}` : ""}`;
    if ("local" in o) return `local:${JSON.stringify(o.local)}`;
    if (typeof o.path === "string") return `path:${o.path}`;
    if (typeof o.spec === "string") return `spec:${o.spec}`;
    if (typeof o.marketplace === "string") {
      return `marketplace:${o.marketplace}:${o.name ?? ""}`;
    }
  }
  return `raw:${JSON.stringify(entry)}`;
}

/** Equality signature — identical declarations are idempotent. */
export function dependencySignature(entry: DependencyEntry): string {
  return JSON.stringify(entry);
}

function unionApmLists(
  base: DependencyEntry[] | undefined,
  extras: DependencyEntry[],
  field: string,
): DependencyEntry[] {
  const out: DependencyEntry[] = base ? [...base] : [];
  const byKey = new Map<string, { entry: DependencyEntry; signature: string }>();
  for (const entry of out) {
    const key = dependencyConflictKey(entry);
    byKey.set(key, { entry, signature: dependencySignature(entry) });
  }

  for (const entry of extras) {
    const key = dependencyConflictKey(entry);
    const signature = dependencySignature(entry);
    const existing = byKey.get(key);
    if (!existing) {
      out.push(entry);
      byKey.set(key, { entry, signature });
      continue;
    }
    if (existing.signature === signature) {
      continue; // idempotent
    }
    const name =
      typeof entry === "object" && entry && typeof (entry as ObjectDependency).name === "string"
        ? (entry as ObjectDependency).name
        : key.replace(/^name:/, "");
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `Manifest preset dependency conflict for "${name}": incompatible constraints/sources disagree across base and included presets`,
      {
        path: field,
        details: { package: name, key, conflict: true },
      },
    );
  }
  return out;
}

function unionDependencyLists(
  base: DependencyLists | undefined,
  extras: DependencyLists[],
  field: string,
): DependencyLists | undefined {
  if (!base && extras.length === 0) return undefined;

  const out: DependencyLists = base ? { ...base } : {};
  const apmExtras: DependencyEntry[] = [];
  for (const extra of extras) {
    if (Array.isArray(extra.apm)) apmExtras.push(...extra.apm);
    for (const [k, v] of Object.entries(extra)) {
      if (k === "apm") continue;
      if (!(k in out)) {
        (out as Record<string, unknown>)[k] = v;
      }
    }
  }

  if (Array.isArray(base?.apm) || apmExtras.length > 0) {
    out.apm = unionApmLists(base?.apm, apmExtras, `${field}.apm`);
  }

  return out;
}

function presetsByIds(
  presets: ManifestPreset[] | undefined,
  presetIds: string[],
): ManifestPreset[] {
  if (!presets || presetIds.length === 0) return [];
  const map = new Map(presets.map((p) => [p.name, p]));
  const out: ManifestPreset[] = [];
  for (const id of presetIds) {
    const p = map.get(id);
    if (p) out.push(p);
  }
  return out;
}

/**
 * Effective direct deps = base ∪ included presets (same-name conflict fail-closed).
 */
export function effectiveDirectDeps(
  doc: BapmManifest | Record<string, unknown>,
  presetIds?: string[],
): EffectiveDirectDeps {
  const manifest = doc as BapmManifest;
  const ids = presetIds ?? resolveActive(manifest).presetIds;
  const included = presetsByIds(manifest.presets, ids);

  const depExtras = included
    .map((p) => p.dependencies)
    .filter((d): d is DependencyLists => d !== undefined && isPlainObject(d));
  const devExtras = included
    .map((p) => p.devDependencies)
    .filter((d): d is DependencyLists => d !== undefined && isPlainObject(d));

  const result: EffectiveDirectDeps = {};
  const dependencies = unionDependencyLists(manifest.dependencies, depExtras, "dependencies");
  const devDependencies = unionDependencyLists(
    manifest.devDependencies,
    devExtras,
    "devDependencies",
  );
  if (dependencies !== undefined) result.dependencies = dependencies;
  if (devDependencies !== undefined) result.devDependencies = devDependencies;
  return result;
}

/** Apply effective deps onto a shallow copy of the manifest (resolve/install). */
export function withEffectiveDirectDeps(manifest: BapmManifest): BapmManifest {
  const { presetIds } = resolveActive(manifest);
  const effective = effectiveDirectDeps(manifest, presetIds);
  return {
    ...manifest,
    ...(effective.dependencies !== undefined ? { dependencies: effective.dependencies } : {}),
    ...(effective.devDependencies !== undefined
      ? { devDependencies: effective.devDependencies }
      : {}),
  };
}

/** Aliases for acceptance helper pickExport. */
export const effectiveManifestDeps = effectiveDirectDeps;
export const unionPresetDependencies = effectiveDirectDeps;
