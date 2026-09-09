/**
 * Top-level `presets` parse/validate.
 */
import { ManifestError } from "./errors.ts";
import { parseActiveField } from "./active.ts";
import type { DependencyLists, ManifestPreset } from "./types.ts";

type ValidateDependencyBlock = (value: unknown, field: string) => DependencyLists;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Parse top-level `presets`: non-empty sequence of uniquely named mappings.
 */
export function parsePresetsField(
  value: unknown,
  validateDependencyBlock: ValidateDependencyBlock,
  pathPrefix = "presets",
): ManifestPreset[] {
  if (!Array.isArray(value)) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      'Manifest "presets" must be a non-empty YAML sequence of mappings',
      { path: pathPrefix },
    );
  }
  if (value.length === 0) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      'Manifest "presets" must be a non-empty sequence (empty [] is rejected)',
      { path: pathPrefix },
    );
  }

  const seen = new Set<string>();
  const out: ManifestPreset[] = [];

  for (let i = 0; i < value.length; i++) {
    const entry = value[i];
    const entryPath = `${pathPrefix}[${i}]`;
    if (!isPlainObject(entry)) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Manifest "${entryPath}" must be a mapping with a unique "name"`,
        { path: entryPath },
      );
    }

    if (!("name" in entry) || typeof entry.name !== "string" || !entry.name.trim()) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Manifest preset at "${entryPath}" requires a non-empty string "name"`,
        { path: `${entryPath}.name` },
      );
    }
    const name = entry.name.trim();
    if (seen.has(name)) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Manifest preset name "${name}" is duplicate (preset names must be unique)`,
        { path: `${entryPath}.name`, details: { name, duplicate: true } },
      );
    }
    seen.add(name);

    const preset: ManifestPreset = { ...entry, name };

    if ("dependencies" in entry && entry.dependencies !== undefined) {
      preset.dependencies = validateDependencyBlock(
        entry.dependencies,
        `${entryPath}.dependencies`,
      );
    }
    if ("devDependencies" in entry && entry.devDependencies !== undefined) {
      preset.devDependencies = validateDependencyBlock(
        entry.devDependencies,
        `${entryPath}.devDependencies`,
      );
    }
    if ("active" in entry && entry.active !== undefined) {
      preset.active = parseActiveField(entry.active, `${entryPath}.active`);
    }

    out.push(preset);
  }

  return out;
}
