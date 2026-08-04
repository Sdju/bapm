/**
 * Shared materialize helpers for host targets (fs/path, primitive content).
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import type { AttributedPrimitive, AttributedPrimitiveSet } from "./types.ts";

/** Normalize `AttributedPrimitiveSet` (array or `{ primitives }`) to a list. */
export function primitivesList(set: AttributedPrimitiveSet): AttributedPrimitive[] {
  if (Array.isArray(set)) return set;
  if (set && typeof set === "object" && Array.isArray(set.primitives)) {
    return set.primitives;
  }
  return [];
}

/** Replace path separators so a primitive name is safe as a single path segment. */
export function sanitizeName(name: string): string {
  return String(name || "unnamed").replace(/[/\\]/g, "-");
}

/** True when `absPath` is `rootRel` or a descendant under `cwd`. */
export function isUnderRoot(cwd: string, absPath: string, rootRel: string): boolean {
  const rootAbs = resolve(cwd, rootRel);
  const rel = relative(rootAbs, absPath);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith(`..${sep}`));
}

/** Throw if `absPath` is outside every registered deploy root. */
export function assertUnderDeployRoots(cwd: string, absPath: string, deployRoots: string[]): void {
  if (!deployRoots.some((r) => isUnderRoot(cwd, absPath, r))) {
    throw new Error(`materialize refuses path outside deploy roots: ${absPath}`);
  }
}

/**
 * Resolve primitive body: inline `content`, preferred nested file, source file,
 * or minimal frontmatter stub.
 */
export function readPrimitiveContent(p: AttributedPrimitive, preferredFile?: string): string {
  if (typeof p.content === "string") return p.content;
  const src = p.path ? resolve(p.path) : undefined;
  if (src && existsSync(src)) {
    if (preferredFile) {
      const nested = src.endsWith(preferredFile) ? src : join(src, preferredFile);
      if (existsSync(nested) && statSync(nested).isFile()) {
        return readFileSync(nested, "utf8");
      }
    }
    if (statSync(src).isFile()) return readFileSync(src, "utf8");
  }
  const name = sanitizeName(String(p.name));
  return `---\nname: ${name}\n---\n# ${name}\n`;
}

/** Absolute path → cwd-relative path with `/` separators. */
export function toPosixRel(cwd: string, absPath: string): string {
  return relative(cwd, absPath).split(sep).join("/");
}
