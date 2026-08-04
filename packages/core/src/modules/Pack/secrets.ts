/**
 * OpenAPM sc-007 producer secret-pattern refuse (fixed denylist for M7).
 * Match against basename of paths that would enter the pack set.
 */

const SECRET_BASENAME_EXACT = new Set([".env", "id_rsa", "id_ed25519"]);

export function isSecretPackPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  const base = normalized.includes("/")
    ? normalized.slice(normalized.lastIndexOf("/") + 1)
    : normalized;

  if (SECRET_BASENAME_EXACT.has(base)) return true;
  if (base.startsWith(".env.")) return true;
  if (base.endsWith(".pem") || base.endsWith(".key")) return true;
  return false;
}

export function describeSecretRefuse(relativePath: string): string {
  return `Pack refused secret-pattern path "${relativePath}" (sc-007)`;
}
