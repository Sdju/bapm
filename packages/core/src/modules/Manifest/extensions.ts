/**
 * OpenAPM req-ext-001 vendor extension keys (`x-[a-z][a-z0-9-]*`).
 *
 * Extension values are not validated or interpreted. Writers preserve them;
 * dependency manifests expose them on the lock row as `extensions` (APM wire).
 */

const EXTENSION_KEY_RE = /^x-[a-z][a-z0-9-]*$/;

/** True when `key` is an OpenAPM vendor extension key. */
export function isManifestExtensionKey(key: unknown): boolean {
  return typeof key === "string" && EXTENSION_KEY_RE.test(key);
}

/**
 * Collect top-level `x-*` keys in declaration order.
 * Returns an empty object when the document declares none.
 */
export function collectManifestExtensions(
  document: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!document) return out;
  for (const [key, value] of Object.entries(document)) {
    if (isManifestExtensionKey(key)) out[key] = value;
  }
  return out;
}
