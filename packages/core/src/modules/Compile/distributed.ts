import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { loadYamlDocument } from "@/common/yaml/loadDocument.ts";
import type { AttributedPrimitive } from "@/modules/Primitives";

/** Directories that must never receive a compile output. */
const CONTROL_DIRS = new Set([".git", "node_modules", "apm_modules", "bapm_modules"]);

const GLOB_META = /[*?[\]{}]/;

export type DistributedPlacement = {
  /** Project-relative directory; empty string means the project root. */
  dir: string;
  primitives: AttributedPrimitive[];
};

export type DistributedPlan = {
  placements: DistributedPlacement[];
};

export function isInstructionPrimitive(primitive: AttributedPrimitive): boolean {
  return /instruction/i.test(String(primitive.type ?? ""));
}

/**
 * Build the deterministic conservative distributed placement plan.
 *
 * Instruction primitives with `applyTo` are placed under the literal directory
 * prefix of each pattern. Global instructions (no patterns, root-only globs
 * such as `**\/*.ts`, or malformed frontmatter) and every non-instruction
 * primitive stay at the project root.
 */
export function buildDistributedPlan(
  primitives: AttributedPrimitive[],
  cwd: string,
): DistributedPlan {
  const root = realpathOrResolve(cwd);
  const rootPrimitives: AttributedPrimitive[] = [];
  const byDir = new Map<string, AttributedPrimitive[]>();

  for (const primitive of primitives) {
    if (!isInstructionPrimitive(primitive)) {
      rootPrimitives.push(primitive);
      continue;
    }

    const patterns = readPrimitiveApplyTo(primitive);
    if (patterns.length === 0) {
      rootPrimitives.push(primitive);
      continue;
    }

    const dirs = new Set<string>();
    for (const pattern of patterns) {
      dirs.add(placementDirectoryForPattern(pattern));
    }

    for (const dir of dirs) {
      if (dir === "") {
        rootPrimitives.push(primitive);
        continue;
      }
      assertSafePlacementDirectory(root, dir, primitive);
      const list = byDir.get(dir) ?? [];
      list.push(primitive);
      byDir.set(dir, list);
    }
  }

  const subdirs = [...byDir.keys()].sort((a, b) => a.localeCompare(b));
  const placements: DistributedPlacement[] = [];
  // Suppress an empty root shell when every instruction is distributed below
  // the root. An entirely empty project still emits the host default.
  if (rootPrimitives.length > 0 || subdirs.length === 0) {
    placements.push({ dir: "", primitives: rootPrimitives });
  }
  for (const dir of subdirs) {
    placements.push({ dir, primitives: byDir.get(dir)! });
  }

  return { placements };
}

/**
 * Extract `applyTo` (canonical APM frontmatter key) or its `globs` host alias
 * from an instruction primitive. Missing/unreadable/invalid frontmatter is
 * treated as global, matching single-file compile's tolerant discovery.
 */
export function readPrimitiveApplyTo(primitive: AttributedPrimitive): string[] {
  const path = typeof primitive.path === "string" ? primitive.path.trim() : "";
  if (!path) return [];
  let text: string;
  try {
    if (!lstatSync(path).isFile()) return [];
    text = readFileSync(path, "utf8");
  } catch {
    return [];
  }

  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(
    text.replace(/^\uFEFF/, ""),
  );
  if (!match) return [];
  let metadata: unknown;
  try {
    metadata = loadYamlDocument(match[1] ?? "", path);
  } catch {
    return [];
  }
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const record = metadata as Record<string, unknown>;
  if (record.applyTo !== undefined) return parseApplyToValue(record.applyTo);
  if (record.globs !== undefined) return parseApplyToValue(record.globs);
  return [];
}

/**
 * Normalize a scalar/comma-list/YAML-list `applyTo` value into individual
 * patterns. Top-level commas split; commas inside `{a,b}` are preserved.
 */
export function parseApplyToValue(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  for (const entry of raw) {
    if (entry === null || entry === undefined) continue;
    out.push(...splitTopLevelCommas(String(entry)));
  }
  return dedupe(out);
}

/**
 * Conservative placement directory for one `applyTo` glob.
 *
 * Uses the literal path prefix before the first glob segment:
 * `src/**` -> `src`, `docs/*.md` -> `docs`, `src/foo.ts` -> `src`.
 * Root-only patterns (`**\/*.ts`, `*.ts`, `{src,lib}/**`) and bare names
 * without a slash return the project root.
 */
export function placementDirectoryForPattern(pattern: string): string {
  let normalized = String(pattern ?? "").trim();
  if (!normalized) return "";
  normalized = normalized.replace(/\\/g, "/");

  if (isAbsolute(normalized) || /^[A-Za-z]:\//.test(normalized)) {
    throw new Error(`Compile refuses absolute applyTo pattern: ${pattern}`);
  }
  if (normalized.startsWith("//")) {
    throw new Error(`Compile refuses absolute applyTo pattern: ${pattern}`);
  }

  const rawParts = normalized.split("/");
  if (rawParts.some((part) => part === "..")) {
    throw new Error(`Compile refuses applyTo pattern that escapes the project: ${pattern}`);
  }
  const segments = rawParts.filter((part) => part !== "" && part !== ".");
  if (segments.length === 0) return "";
  for (const segment of segments) {
    if (CONTROL_DIRS.has(segment)) {
      throw new Error(
        `Compile refuses applyTo pattern inside control directory "${segment}": ${pattern}`,
      );
    }
  }

  const firstGlob = segments.findIndex((segment) => GLOB_META.test(segment));
  if (firstGlob === 0) return "";
  if (firstGlob > 0) return segments.slice(0, firstGlob).join("/");

  // No glob: a literal path. Bare names are ambiguous (file or directory) and
  // stay global, matching APM; multi-segment paths use their dirname.
  if (normalized.endsWith("/")) return segments.join("/");
  if (segments.length <= 1) return "";
  return segments.slice(0, -1).join("/");
}

/**
 * Fail closed before any host write when an output path would leave the
 * project or traverse a symlink. The check covers existing ancestors only;
 * missing directories are created by the host writer.
 */
export function assertSafeCompileOutput(cwd: string, relPath: string): void {
  const root = realpathOrResolve(cwd);
  const normalized = String(relPath ?? "").replace(/\\/g, "/");
  if (!normalized || isAbsolute(normalized)) {
    throw new Error(`Compile output must be a project-relative path: ${relPath}`);
  }
  const segments = normalized.split("/").filter((part) => part !== "" && part !== ".");
  if (segments.some((part) => part === "..")) {
    throw new Error(`Compile output escapes the project: ${relPath}`);
  }
  for (const segment of segments.slice(0, -1)) {
    if (CONTROL_DIRS.has(segment)) {
      throw new Error(`Compile refuses to write inside control directory "${segment}": ${relPath}`);
    }
  }

  const abs = resolve(root, normalized);
  if (!isWithin(root, abs)) {
    throw new Error(`Compile output escapes the project: ${relPath}`);
  }
  assertNoSymlinkComponents(root, abs, relPath);
}

function assertSafePlacementDirectory(
  root: string,
  dir: string,
  primitive: AttributedPrimitive,
): void {
  const abs = resolve(root, dir);
  if (!isWithin(root, abs)) {
    throw new Error(`Compile applyTo for "${primitive.name}" escapes the project: ${dir}`);
  }
  assertNoSymlinkComponents(root, abs, dir);
  try {
    if (!lstatSync(abs).isDirectory()) {
      throw new Error(`Compile placement directory is not a directory: ${dir}`);
    }
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
}

function assertNoSymlinkComponents(root: string, abs: string, relPath: string): void {
  const parts = relative(root, abs)
    .split(sep)
    .filter((part) => part !== "" && part !== ".");
  let current = root;
  for (let index = 0; index < parts.length; index += 1) {
    current = join(current, parts[index]!);
    let stats;
    try {
      stats = lstatSync(current);
    } catch (error) {
      if (isMissing(error)) return;
      throw error;
    }
    if (stats.isSymbolicLink()) {
      throw new Error(
        `Compile refuses symlinked output path "${relPath}"; distributed writes must stay inside the project`,
      );
    }
    if (index < parts.length - 1 && !stats.isDirectory()) {
      throw new Error(`Compile output parent is not a directory: ${relPath}`);
    }
  }
}

function splitTopLevelCommas(value: string): string[] {
  const out: string[] = [];
  let current = "";
  let braceDepth = 0;
  let inCharacterClass = false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]!;
    if (char === "\\" && index + 1 < value.length) {
      const next = value[index + 1]!;
      if (next === "," || next === "\\") {
        current += next;
        index += 1;
        continue;
      }
    }
    if (inCharacterClass) {
      current += char;
      if (char === "]") inCharacterClass = false;
      continue;
    }
    if (char === "[") {
      inCharacterClass = true;
      current += char;
      continue;
    }
    if (char === "{") {
      braceDepth += 1;
      current += char;
      continue;
    }
    if (char === "}") {
      if (braceDepth > 0) braceDepth -= 1;
      current += char;
      continue;
    }
    if (char === "," && braceDepth === 0) {
      pushPattern(out, current);
      current = "";
      continue;
    }
    current += char;
  }
  pushPattern(out, current);
  return out;
}

function pushPattern(out: string[], value: string): void {
  const trimmed = value
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
  if (trimmed) out.push(trimmed);
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function isWithin(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function realpathOrResolve(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}
