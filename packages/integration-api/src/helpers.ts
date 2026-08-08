/**
 * Shared materialize helpers for host targets (fs/path, primitive content).
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve, sep, dirname } from "node:path";
import type {
  AttributedPrimitive,
  AttributedPrimitiveSet,
  BapmIntegration,
  ConfigureMcpFn,
  DeployedFile,
} from "./types.ts";

/** Normalize `AttributedPrimitiveSet` (array or `{ primitives }`) to a list. */
export function primitivesList(set: AttributedPrimitiveSet): AttributedPrimitive[] {
  if (Array.isArray(set)) return set;
  if (set && typeof set === "object" && Array.isArray(set.primitives)) {
    return set.primitives;
  }
  return [];
}

/** Known primitive kinds dispatched by `primitivesMaterialize`. */
export type PrimitiveMaterializeKind = "skill" | "instruction" | "agent" | "command" | "hook";

/** Context passed to each materialize handler. */
export type PrimitiveMaterializeContext = {
  /** Path-safe single segment from `primitive.name`. */
  name: string;
  /** Lowercased `primitive.type` (default `"skill"`). */
  type: string;
};

export type PrimitiveMaterializeHandler = (
  primitive: AttributedPrimitive,
  ctx: PrimitiveMaterializeContext,
) => void | Promise<void>;

/**
 * Host handlers keyed by primitive kind. Missing keys are skipped.
 * `unknown` runs only when the type matches no known kind.
 */
export type PrimitiveMaterializeHandlers = Partial<
  Record<PrimitiveMaterializeKind, PrimitiveMaterializeHandler>
> & {
  unknown?: PrimitiveMaterializeHandler;
};

const KIND_MATCHERS: Array<{ kind: PrimitiveMaterializeKind; test: RegExp }> = [
  { kind: "skill", test: /skill/ },
  { kind: "instruction", test: /instruction/ },
  { kind: "agent", test: /agent/ },
  { kind: "command", test: /command/ },
  { kind: "hook", test: /hook/ },
];

function resolvePrimitiveKind(type: string): PrimitiveMaterializeKind | undefined {
  for (const { kind, test } of KIND_MATCHERS) {
    if (test.test(type)) return kind;
  }
  return undefined;
}

/**
 * Dispatch each primitive to a typed handler (`skill`, `instruction`, …).
 * Prefer this over a manual `primitivesList` + `if (/skill/)` loop in hosts.
 * Known kinds without a handler are skipped; `unknown` covers unmatched types.
 */
export async function primitivesMaterialize(
  set: AttributedPrimitiveSet,
  handlers: PrimitiveMaterializeHandlers,
): Promise<void> {
  for (const primitive of primitivesList(set)) {
    const type = String(primitive.type ?? "skill").toLowerCase();
    const name = sanitizeName(String(primitive.name));
    const ctx: PrimitiveMaterializeContext = { name, type };
    const kind = resolvePrimitiveKind(type);
    const handler = kind ? handlers[kind] : handlers.unknown;
    if (handler) await handler(primitive, ctx);
  }
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

/**
 * Walk up from `startPath` (file or directory) to the nearest package root
 * marked by `apm.yml`, `bapm.yml`, or `plugin.json`.
 * Falls back to `dirname(startPath)` when no marker is found.
 */
export function findPackageRoot(startPath: string): string {
  let dir =
    existsSync(startPath) && statSync(startPath).isDirectory() ? startPath : dirname(startPath);
  for (;;) {
    if (
      existsSync(join(dir, "apm.yml")) ||
      existsSync(join(dir, "bapm.yml")) ||
      existsSync(join(dir, "plugin.json"))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return existsSync(startPath) && statSync(startPath).isDirectory()
    ? startPath
    : dirname(startPath);
}

/** True when `candidate` is `root` or a descendant (path containment). */
export function isWithin(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/") && rel !== "..");
}

/** Recursively list files under `dir` (absolute paths). */
export function listFiles(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...listFiles(path));
    else files.push(path);
  }
  return files;
}

function treeIsContained(directory: string, root: string, visited: Set<string>): boolean {
  if (visited.has(directory)) return true;
  visited.add(directory);
  for (const entry of readdirSync(directory)) {
    const resolved = realpathSync(join(directory, entry));
    if (!isWithin(root, resolved)) return false;
    if (statSync(resolved).isDirectory() && !treeIsContained(resolved, root, visited)) return false;
  }
  return true;
}

/**
 * Copy a validated portable Agent Plugin skill directory without retaining symlinks.
 * Throws when the skill escapes `pluginRoot`.
 */
export function copyPortableSkillDirectory(
  sourceDir: string,
  pluginRoot: unknown,
  destDir: string,
): void {
  const source = realpathSync(sourceDir);
  const root = typeof pluginRoot === "string" ? realpathSync(pluginRoot) : undefined;
  if (!root || !isWithin(root, source) || !statSync(source).isDirectory()) {
    throw new Error("Agent Plugin skill directory is outside its plugin root");
  }
  const skillFile = realpathSync(join(source, "SKILL.md"));
  if (
    !isWithin(root, skillFile) ||
    !statSync(skillFile).isFile() ||
    !treeIsContained(source, root, new Set())
  ) {
    throw new Error("Agent Plugin skill contains a path outside its plugin root");
  }
  mkdirSync(destDir, { recursive: true });
  cpSync(source, destDir, { recursive: true, dereference: true, force: true });
}

/**
 * Host-agnostic skill materialize: Agent Plugin tree / SKILL.md copy / content stub.
 * Hosts only choose `destDir` (cwd-relative or absolute under deploy roots).
 */
export function materializeSkill(args: {
  primitive: AttributedPrimitive;
  cwd: string;
  deployRoots: string[];
  /** Destination skill directory (e.g. `.agents/skills/hello` or absolute). */
  destDir: string;
}): DeployedFile[] {
  const { primitive: p, cwd, deployRoots } = args;
  const destDir = resolve(cwd, args.destDir);
  const destFile = join(destDir, "SKILL.md");
  assertUnderDeployRoots(cwd, destFile, deployRoots);
  mkdirSync(destDir, { recursive: true });

  const src = p.path ? resolve(p.path) : undefined;
  if (p.format === "agent-plugin" && typeof p.skillDirectory === "string") {
    copyPortableSkillDirectory(p.skillDirectory, p.pluginRoot, destDir);
  } else if (src && existsSync(src)) {
    const skillMd = src.endsWith("SKILL.md") ? src : join(src, "SKILL.md");
    if (existsSync(skillMd) && statSync(skillMd).isFile()) {
      cpSync(skillMd, destFile);
    } else {
      writeFileSync(destFile, readPrimitiveContent(p, "SKILL.md"), "utf8");
    }
  } else {
    writeFileSync(destFile, readPrimitiveContent(p, "SKILL.md"), "utf8");
  }

  return listFiles(destDir).map((path) => ({
    path: toPosixRel(cwd, path),
    primitive: { name: String(p.name), packageName: p.packageName },
  }));
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
