/**
 * Shared materialize helpers for host targets (fs/path, primitive content).
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import type {
  AttributedPrimitive,
  AttributedPrimitiveSet,
  BapmIntegration,
  ConfigureMcpFn,
} from "./types.ts";

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

const MCP_CONFIGURE_ALIASES = [
  "configureMcp",
  "writeMcpConfig",
  "deployMcp",
  "configureMcpServers",
] as const;

/** True when the target exposes an MCP configure hook (any documented alias). */
export function hasConfigureMcp(target: BapmIntegration | Record<string, unknown>): boolean {
  return getConfigureMcp(target) !== undefined;
}

/**
 * Resolve optional MCP configure from a registered target.
 * Accepts `configureMcp` and documented aliases without requiring every host to
 * use the same method name.
 */
export function getConfigureMcp(
  target: BapmIntegration | Record<string, unknown>,
): ConfigureMcpFn | undefined {
  const rec = target as Record<string, unknown>;
  for (const key of MCP_CONFIGURE_ALIASES) {
    const fn = rec[key];
    if (typeof fn === "function") {
      return (fn as ConfigureMcpFn).bind(target);
    }
  }
  return undefined;
}
