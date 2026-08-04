/** Hash envelope normalize (OpenAPM req-lk-016). */

const BARE_HEX_64 = /^[0-9a-fA-F]{64}$/;
const ENVELOPE = /^[a-zA-Z0-9]+:[0-9a-fA-F]+$/;

/**
 * Bare 64-hex → `sha256:<hex>`; envelope form kept; other strings passed through.
 */
export function normalizeHashValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (BARE_HEX_64.test(trimmed)) {
    return `sha256:${trimmed.toLowerCase()}`;
  }
  if (ENVELOPE.test(trimmed)) {
    const colon = trimmed.indexOf(":");
    const algo = trimmed.slice(0, colon);
    const hex = trimmed.slice(colon + 1);
    return `${algo}:${hex.toLowerCase()}`;
  }
  return value;
}

export function normalizeHashMap(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const normalized = normalizeHashValue(v);
    out[k] = typeof normalized === "string" ? normalized : String(v);
  }
  return out;
}

export const DEP_HASH_SCALAR_KEYS = ["resolved_hash", "tree_sha256", "source_digest"] as const;
