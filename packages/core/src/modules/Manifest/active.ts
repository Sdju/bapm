/**
 * Structured `active` parse / emit helpers (preset | target, optional `!` negate).
 */
import { ManifestError } from "./errors.ts";
import { isValidTargetToken } from "./targets.ts";
import type { ActiveEntry } from "./types.ts";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNormalizedActiveEntry(value: unknown): value is ActiveEntry {
  if (!isPlainObject(value)) return false;
  const kind = value.kind;
  const id = value.id;
  return (
    (kind === "preset" || kind === "target") &&
    typeof id === "string" &&
    id.length > 0 &&
    typeof value.negate === "boolean"
  );
}

function assertValidTargetToken(token: string, path: string): void {
  if (isValidTargetToken(token)) return;
  throw new ManifestError(
    "MANIFEST_VALIDATION",
    `Invalid target token "${token}" (mf-005): must be a canonical host id, recognised alias, or x-<vendor>-<name>`,
    { path, details: { token } },
  );
}

function parseSignedId(
  raw: string,
  kind: "preset" | "target",
  path: string,
): { id: string; negate: boolean } {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `Manifest "${path}" must be a non-empty string`,
      { path },
    );
  }
  const negate = trimmed.startsWith("!");
  const id = negate ? trimmed.slice(1).trim() : trimmed;
  if (!id) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `Manifest "${path}" negation requires a non-empty id after "!"`,
      { path },
    );
  }
  if (kind === "target") {
    assertValidTargetToken(id, path);
  }
  return { id, negate };
}

function parseSingleKeyMap(entry: unknown, path: string): ActiveEntry {
  if (!isPlainObject(entry)) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `Manifest "${path}" must be a single-key mapping with "preset" or "target"`,
      { path },
    );
  }
  const keys = Object.keys(entry);
  if (keys.length !== 1) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `Manifest "${path}" must be a single-key mapping with "preset" or "target"`,
      { path },
    );
  }
  const key = keys[0]!;
  if (key !== "preset" && key !== "target") {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `Manifest "${path}" key must be "preset" or "target" (got "${key}")`,
      { path },
    );
  }
  const value = entry[key];
  if (typeof value !== "string") {
    throw new ManifestError("MANIFEST_VALIDATION", `Manifest "${path}.${key}" must be a string`, {
      path: `${path}.${key}`,
    });
  }
  const { id, negate } = parseSignedId(value, key, `${path}.${key}`);
  return { kind: key, id, negate };
}

function parseObjectFormValue(
  value: unknown,
  kind: "preset" | "target",
  path: string,
): ActiveEntry[] {
  if (typeof value === "string") {
    const { id, negate } = parseSignedId(value, kind, path);
    return [{ kind, id, negate }];
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Manifest "${path}" must be a non-empty string or non-empty sequence`,
        { path },
      );
    }
    const out: ActiveEntry[] = [];
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (typeof item !== "string") {
        throw new ManifestError(
          "MANIFEST_VALIDATION",
          `Manifest "${path}[${i}]" must be a string`,
          { path: `${path}[${i}]` },
        );
      }
      const { id, negate } = parseSignedId(item, kind, `${path}[${i}]`);
      out.push({ kind, id, negate });
    }
    return out;
  }
  throw new ManifestError(
    "MANIFEST_VALIDATION",
    `Manifest "${path}" must be a non-empty string or non-empty sequence of strings`,
    { path },
  );
}

/**
 * Parse structured `active` (list-of-maps or object form). Rejects legacy bare
 * host-token lists, empty `[]`/`{}`, and scalars.
 */
export function parseActiveField(value: unknown, pathPrefix = "active"): ActiveEntry[] {
  // Internal round-trip: already-normalized ActiveEntry[]
  if (Array.isArray(value) && value.length > 0 && value.every(isNormalizedActiveEntry)) {
    return value.map((e) => ({ kind: e.kind, id: e.id, negate: e.negate }));
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        'Manifest "active" must be a non-empty structured selection (empty [] is rejected)',
        { path: pathPrefix },
      );
    }
    // Legacy bare host-token list: sequence of strings
    if (value.some((entry) => typeof entry === "string")) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        'Manifest "active" rejects legacy bare host-token lists; use structured preset/target maps or object form (e.g. { target: cursor } or [{ target: cursor }])',
        { path: pathPrefix },
      );
    }
    return value.map((entry, i) => parseSingleKeyMap(entry, `${pathPrefix}[${i}]`));
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        'Manifest "active" must be a non-empty structured selection (empty {} is rejected; require preset and/or target)',
        { path: pathPrefix },
      );
    }
    for (const key of keys) {
      if (key !== "preset" && key !== "target") {
        throw new ManifestError(
          "MANIFEST_VALIDATION",
          `Manifest "${pathPrefix}" object form allows only "preset" and/or "target" keys (got "${key}")`,
          { path: `${pathPrefix}.${key}` },
        );
      }
    }
    if (!("preset" in value) && !("target" in value)) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        'Manifest "active" object form requires "preset" and/or "target"',
        { path: pathPrefix },
      );
    }
    const out: ActiveEntry[] = [];
    // Object form: presets first, then targets (design).
    if ("preset" in value && value.preset !== undefined) {
      out.push(...parseObjectFormValue(value.preset, "preset", `${pathPrefix}.preset`));
    }
    if ("target" in value && value.target !== undefined) {
      out.push(...parseObjectFormValue(value.target, "target", `${pathPrefix}.target`));
    }
    if (out.length === 0) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        'Manifest "active" must select at least one preset or target',
        { path: pathPrefix },
      );
    }
    return out;
  }

  throw new ManifestError(
    "MANIFEST_VALIDATION",
    'Manifest "active" must be a structured object or sequence of preset/target maps (not a scalar)',
    { path: pathPrefix },
  );
}

/** Convert normalized entries to YAML-friendly list-of-maps for emit. */
export function activeEntriesToEmitShape(entries: ActiveEntry[]): Array<Record<string, string>> {
  return entries.map((e) => {
    const value = e.negate ? `!${e.id}` : e.id;
    return { [e.kind]: value };
  });
}
