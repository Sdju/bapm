import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { BapmManifest } from "@/modules/Manifest";
import { loadManifest } from "@/modules/Manifest";
import type { PackFileEntry } from "./collect.ts";
import { PackError } from "./errors.ts";

/** Claude Code native manifest location inside a plugin bundle. */
export const CLAUDE_NATIVE_MANIFEST_PATH = ".claude-plugin/plugin.json";
/** Root manifest kept for APM/bapm plugin consumers. */
export const CLAUDE_ROOT_MANIFEST_PATH = "plugin.json";

/** Authoring files that belong to bapm/APM, not to a Claude plugin distribution. */
const APM_AUTHORING_ROOT_FILES = new Set([
  "bapm.yml",
  "apm.yml",
  "bapm.lock.yaml",
  "apm.lock.yaml",
  ".claude-plugin/marketplace.json",
]);

type JsonObject = Record<string, unknown>;

export type BuildClaudePluginBundleOptions = {
  /** Package root. */
  root: string;
  /** Collected pack set (hard excludes, `.bapmignore`, secrets already applied). */
  entries: PackFileEntry[];
};

export type ClaudePluginBundle = {
  /** Bundle relative `/` paths to bytes. Includes generated manifests. */
  files: Record<string, Uint8Array>;
  /** Parsed/generated Claude plugin manifest. */
  manifest: JsonObject;
  name: string;
  version: string;
};

/**
 * Build a Claude Code plugin bundle from a package root.
 *
 * The bundle preserves the package's plugin-native tree (`commands/`, `agents/`,
 * `skills/`, `hooks/`, sibling assets) at the same relative paths, drops root
 * APM authoring manifests/locks, and writes the manifest at both
 * `plugin.json` and `.claude-plugin/plugin.json`.
 *
 * Declared path fields in the source manifest (`commands`, `hooks`, `agents`,
 * `skills`, and string path forms of `mcpServers`/`lspServers`/`monitors`) are
 * resolved before write. Missing, traversing, symlinked, or `.bapmignore`d
 * declarations fail closed.
 */
export function buildClaudePluginBundle(
  options: BuildClaudePluginBundleOptions,
): ClaudePluginBundle {
  const root = resolve(options.root);
  const manifest = loadClaudePluginManifest(root);
  assertManifestName(manifest);

  const packed = new Set(options.entries.map((entry) => entry.relativePath));
  validateDeclaredPaths({ root, manifest, packed });

  if (manifest.hooks === undefined) {
    // Root `hooks.json` is APM's merged hook document; declare it for Claude.
    if (packed.has("hooks.json")) manifest.hooks = "./hooks.json";
  }

  const files: Record<string, Uint8Array> = {};
  for (const entry of options.entries) {
    assertSafeBundlePath(entry.relativePath);
    if (APM_AUTHORING_ROOT_FILES.has(entry.relativePath)) continue;
    files[entry.relativePath] = entry.bytes;
  }

  const serialized = new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`);
  files[CLAUDE_ROOT_MANIFEST_PATH] = serialized;
  files[CLAUDE_NATIVE_MANIFEST_PATH] = serialized;

  return {
    files,
    manifest,
    name: manifest.name as string,
    version: typeof manifest.version === "string" && manifest.version ? manifest.version : "0.0.0",
  };
}

function loadClaudePluginManifest(root: string): JsonObject {
  const authored =
    readOptionalJson(root, CLAUDE_ROOT_MANIFEST_PATH) ??
    readOptionalJson(root, CLAUDE_NATIVE_MANIFEST_PATH);
  if (authored) return authored;

  const loaded = tryLoadBapmManifest(root);
  if (!loaded) {
    throw new PackError(
      "PACK_VALIDATION",
      "Claude plugin pack requires plugin.json or .claude-plugin/plugin.json, or a valid bapm.yml/apm.yml to synthesize one",
    );
  }
  return synthesizeClaudeManifest(loaded);
}

function readOptionalJson(root: string, relativePath: string): JsonObject | undefined {
  const candidate = join(root, relativePath);
  if (!existsSync(candidate)) return undefined;

  const stat = lstatSync(candidate);
  if (stat.isSymbolicLink()) {
    throw new PackError(
      "PACK_VALIDATION",
      `Refusing unsafe symbolic-link Claude plugin manifest: ${relativePath}`,
      { path: relativePath },
    );
  }
  if (!stat.isFile()) {
    throw new PackError(
      "PACK_VALIDATION",
      `Claude plugin manifest is not a regular file: ${relativePath}`,
      { path: relativePath },
    );
  }

  try {
    const parsed: unknown = JSON.parse(readFileSync(candidate, "utf8"));
    if (!isRecord(parsed)) {
      throw new Error("must contain a top-level JSON object");
    }
    return parsed;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new PackError(
      "PACK_VALIDATION",
      `Claude plugin manifest is not valid JSON: ${relativePath}: ${message}`,
      {
        path: relativePath,
        cause,
      },
    );
  }
}

function tryLoadBapmManifest(root: string): BapmManifest | undefined {
  try {
    return loadManifest({ cwd: root }).document;
  } catch {
    return undefined;
  }
}

function synthesizeClaudeManifest(document: BapmManifest): JsonObject {
  const manifest: JsonObject = { name: document.name };
  for (const field of ["version", "description", "homepage", "repository", "license"] as const) {
    const value = document[field];
    if (typeof value === "string" && value.length > 0) manifest[field] = value;
  }
  if (typeof document.author === "string" && document.author.length > 0) {
    manifest.author = { name: document.author };
  } else if (isRecord(document.author) && typeof document.author.name === "string") {
    manifest.author = {
      name: document.author.name,
      ...(typeof document.author.email === "string" ? { email: document.author.email } : {}),
      ...(typeof document.author.url === "string" ? { url: document.author.url } : {}),
    };
  }
  if (Array.isArray(document.keywords)) {
    manifest.keywords = document.keywords.filter((item) => typeof item === "string");
  }
  return manifest;
}

function assertManifestName(manifest: JsonObject): void {
  if (typeof manifest.name !== "string" || manifest.name.trim().length === 0) {
    throw new PackError(
      "PACK_VALIDATION",
      'Claude plugin manifest must declare a non-empty "name" field',
      { path: CLAUDE_ROOT_MANIFEST_PATH },
    );
  }
}

type DeclaredFieldKind = "file" | "file-or-directory";

const DECLARED_PATH_FIELDS: ReadonlyArray<{ field: string; kind: DeclaredFieldKind }> = [
  { field: "commands", kind: "file" },
  { field: "hooks", kind: "file" },
  { field: "agents", kind: "file" },
  { field: "skills", kind: "file-or-directory" },
  { field: "mcpServers", kind: "file" },
  { field: "lspServers", kind: "file" },
  { field: "monitors", kind: "file" },
];

function validateDeclaredPaths(args: {
  root: string;
  manifest: JsonObject;
  packed: Set<string>;
}): void {
  for (const { field, kind } of DECLARED_PATH_FIELDS) {
    for (const declaredPath of declaredPathStrings(args.manifest[field])) {
      validateDeclaredPath({ ...args, field, kind, declaredPath });
    }
  }
}

function declaredPathStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

function validateDeclaredPath(args: {
  root: string;
  packed: Set<string>;
  field: string;
  kind: DeclaredFieldKind;
  declaredPath: string;
}): void {
  const { root, field, declaredPath } = args;
  const trimmed = declaredPath.trim();
  if (!trimmed) {
    throwDeclared(field, "is empty", declaredPath, root);
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return;

  const normalized = trimmed.replace(/\\/g, "/");
  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split("/").includes("..") ||
    normalized.includes("\0")
  ) {
    const kind =
      normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized) ? "absolute" : "path traversal";
    throwDeclared(field, `escapes the plugin root (${kind})`, declaredPath, root);
  }

  let relativePath = normalized.replace(/^\.\//, "");
  if (!relativePath || relativePath === ".") {
    throwDeclared(field, "does not name a plugin file", declaredPath, root);
  }

  // Agent Plugins authoring commonly declares a bare skill name (`hello`);
  // Claude plugin bundles keep that skill at the conventional location.
  if (
    field === "skills" &&
    !normalized.startsWith("./") &&
    !relativePath.startsWith("skills/") &&
    existsSync(join(root, "skills", relativePath))
  ) {
    relativePath = `skills/${relativePath}`;
  }

  const candidate = resolve(root, relativePath);
  if (!isWithin(root, candidate)) {
    throwDeclared(field, "escapes the plugin root", declaredPath, root);
  }
  assertNoSymlinkAncestors(root, candidate, field, declaredPath);
  if (!existsSync(candidate)) {
    throwDeclared(field, "is missing", declaredPath, root);
  }

  const stat = lstatSync(candidate);
  const acceptsDirectory = args.kind === "file-or-directory" && stat.isDirectory();
  if (!stat.isFile() && !acceptsDirectory) {
    throwDeclared(field, "is not a regular plugin file", declaredPath, root);
  }

  if (stat.isDirectory()) {
    for (const file of filesUnder(root, candidate, field, declaredPath)) {
      assertInPackSet(args.packed, file, field, declaredPath, root);
    }
  } else {
    assertInPackSet(args.packed, realRelative(root, candidate), field, declaredPath, root);
  }
}

function assertInPackSet(
  packed: Set<string>,
  relativePath: string,
  field: string,
  declaredPath: string,
  root: string,
): void {
  if (!packed.has(relativePath)) {
    throwDeclared(
      field,
      `includes "${relativePath}" which is not in the Claude plugin pack set (excluded by .bapmignore or hard pack rules)`,
      declaredPath,
      root,
    );
  }
}

function filesUnder(root: string, dir: string, field: string, declaredPath: string): string[] {
  const files: string[] = [];
  const visit = (current: string): void => {
    for (const name of readdirSync(current)) {
      const absolute = join(current, name);
      const stat = lstatSync(absolute);
      if (stat.isSymbolicLink()) {
        throwDeclared(
          field,
          `includes a symbolic link: ${realRelative(root, absolute)}`,
          declaredPath,
          root,
        );
      }
      if (stat.isDirectory()) visit(absolute);
      else if (stat.isFile()) files.push(realRelative(root, absolute));
    }
  };
  visit(dir);
  return files;
}

function assertNoSymlinkAncestors(
  root: string,
  candidate: string,
  field: string,
  declaredPath: string,
): void {
  const parts = relative(root, candidate).split(sep);
  let current = root;
  for (const part of parts) {
    current = join(current, part);
    if (!existsSync(current)) return;
    if (lstatSync(current).isSymbolicLink()) {
      throwDeclared(
        field,
        `uses a symbolic link: ${realRelative(root, current)}`,
        declaredPath,
        root,
      );
    }
  }
}

function throwDeclared(field: string, detail: string, declaredPath: string, root: string): never {
  throw new PackError(
    "PACK_VALIDATION",
    `Declared ${field} path ${detail}: ${declaredPath} (plugin root: ${root})`,
    { path: declaredPath, details: { field, declaredPath } },
  );
}

function assertSafeBundlePath(relativePath: string): void {
  const normalized = relativePath.replace(/\\/g, "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split("/").includes("..") ||
    normalized.includes("\0") ||
    isAbsolute(relativePath)
  ) {
    throw new PackError(
      "PACK_VALIDATION",
      `Refusing unsafe Claude plugin bundle path: ${relativePath}`,
      {
        path: relativePath,
      },
    );
  }
}

function isWithin(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
}

function realRelative(root: string, candidate: string): string {
  return relative(root, candidate).split(sep).join("/");
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
