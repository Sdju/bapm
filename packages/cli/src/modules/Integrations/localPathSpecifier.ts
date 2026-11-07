import { homedir } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";

/**
 * Node-like path heuristic for object-map integration values.
 * Values that look like filesystem paths are local; everything else is npm.
 */
export function isLocalPathSpecifier(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.startsWith("./") || trimmed.startsWith("../")) return true;
  if (trimmed.startsWith("/") || trimmed.startsWith("\\")) return true;
  if (trimmed.startsWith("\\\\")) return true;
  if (/^[A-Za-z]:[\\/]/.test(trimmed)) return true;
  if (trimmed === "~" || trimmed.startsWith("~/") || trimmed.startsWith("~\\")) return true;
  return false;
}

/**
 * Lexical project-root containment (same policy as Core `resolveLocalPath`).
 * Returns the absolute normalized target when contained; otherwise `null`.
 */
export function resolveContainedLocalPath(
  originalPath: string,
  projectRoot: string,
): string | null {
  const pathSyntax = originalPath.trim().replaceAll("\\", "/");
  const target =
    pathSyntax === "~" || pathSyntax.startsWith("~/")
      ? resolve(homedir(), pathSyntax.slice(1))
      : isAbsolute(pathSyntax)
        ? resolve(pathSyntax)
        : resolve(projectRoot, pathSyntax);
  const root = resolve(projectRoot);
  const targetRelativeToRoot = relative(root, target);

  if (
    targetRelativeToRoot !== "" &&
    (targetRelativeToRoot === ".." ||
      targetRelativeToRoot.startsWith("..\\") ||
      targetRelativeToRoot.startsWith("../") ||
      isAbsolute(targetRelativeToRoot))
  ) {
    return null;
  }

  return target;
}
