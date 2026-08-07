/**
 * Bapm-only `local` source discriminator helpers (expand default / custom path).
 */

/** Default package root when `local` has no custom path. */
export const DEFAULT_LOCAL_ROOT = ".agents/local";

/**
 * Expand a parsed `local` value to the effective project-relative path.
 * `true` | `null` | `""` | `undefined` → `.agents/local`; non-empty string → as-is.
 */
export function effectiveLocalPath(local: unknown): string {
  if (local === true || local === null || local === undefined || local === "") {
    return DEFAULT_LOCAL_ROOT;
  }
  if (typeof local === "string") {
    return local;
  }
  // Parse should have rejected; defensive fallback for classify callers.
  return DEFAULT_LOCAL_ROOT;
}

/** Normalize a relative local root to a stable rooted gitignore pattern. */
export function localRootGitignorePattern(effectivePath: string): string {
  const normalized = effectivePath
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/\/+$/, "");
  return `/${normalized}/`;
}
