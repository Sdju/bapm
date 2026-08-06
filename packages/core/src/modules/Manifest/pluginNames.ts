/** Plugin id: starts with a letter; lowercase alnum + hyphen; max 64 chars. */
const PLUGIN_NAME_RE = /^[a-z][a-z0-9-]{0,63}$/;

/**
 * Validate a kebab-case plugin name (`^[a-z][a-z0-9-]{0,63}$`).
 * Returns `{ ok: true }` or `{ ok: false, message }`.
 */
export function validatePluginName(name: string): { ok: true } | { ok: false; message: string } {
  if (typeof name !== "string" || !PLUGIN_NAME_RE.test(name)) {
    return {
      ok: false,
      message: `Invalid plugin name: ${JSON.stringify(name)} (expected kebab-case /^[a-z][a-z0-9-]{0,63}$/)`,
    };
  }
  return { ok: true };
}

/**
 * Path-safe project / subdirectory name for plugin init.
 * Rejects empty, path separators (`/`, `\`), and `..` segments.
 */
export function validateProjectName(name: string): { ok: true } | { ok: false; message: string } {
  if (typeof name !== "string" || name.length === 0) {
    return { ok: false, message: "Invalid project name: empty" };
  }
  if (name.includes("/") || name.includes("\\")) {
    return {
      ok: false,
      message: `Invalid project name: ${JSON.stringify(name)} (path separators not allowed)`,
    };
  }
  if (name === ".." || name.includes("..")) {
    return {
      ok: false,
      message: `Invalid project name: ${JSON.stringify(name)} (".." not allowed)`,
    };
  }
  return { ok: true };
}

/** Boolean alias for callers that prefer a simple predicate. */
export function isValidPluginName(name: string): boolean {
  return validatePluginName(name).ok;
}

/** Boolean alias for callers that prefer a simple predicate. */
export function isValidProjectName(name: string): boolean {
  return validateProjectName(name).ok;
}
