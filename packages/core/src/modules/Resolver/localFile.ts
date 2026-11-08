/**
 * Local single-file dependencies (APM 0.35 parity).
 *
 * A local `path:` (or bapm `local:`) may point at one supported primitive file
 * instead of a package directory. APM treats such a file as a virtual package:
 * the suffix selects the primitive directory/type, the file must be a regular
 * (non-symlink) file with valid YAML frontmatter, and install materializes a
 * snapshot package containing the file plus a generated manifest.
 */
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { loadYamlDocument } from "@/common/yaml/loadDocument.ts";
import { computeCanonicalTreeSha256 } from "@/modules/Lockfile";
import { ResolverError } from "./errors.ts";

export type LocalFilePrimitiveType = "agent" | "instruction" | "command";

export type LocalFileInfo = {
  filename: string;
  /** bapm primitive type used by discovery/materializers. */
  type: LocalFilePrimitiveType;
  /** Path inside a virtual package's `.apm/` layout. */
  subdirectory: "agents" | "instructions" | "prompts";
  /** Primitive name (filename without the APM suffix). */
  name: string;
};

export type AdmittedLocalFile = LocalFileInfo & {
  path: string;
  content: Buffer;
};

const SUFFIXES: ReadonlyArray<{
  suffix: string;
  type: LocalFilePrimitiveType;
  subdirectory: LocalFileInfo["subdirectory"];
}> = [
  { suffix: ".agent.md", type: "agent", subdirectory: "agents" },
  { suffix: ".instructions.md", type: "instruction", subdirectory: "instructions" },
  { suffix: ".prompt.md", type: "command", subdirectory: "prompts" },
];

/** Classify a filename by one of APM's supported single-file suffixes. */
export function localFileInfo(filename: string): LocalFileInfo | undefined {
  const file = basename(filename.replaceAll("\\", "/"));
  for (const entry of SUFFIXES) {
    if (!file.endsWith(entry.suffix)) continue;
    const name = file.slice(0, -entry.suffix.length);
    if (!name) return undefined;
    return {
      filename: file,
      type: entry.type,
      subdirectory: entry.subdirectory,
      name,
    };
  }
  return undefined;
}

/** True when an existing path is a regular file with a supported suffix. */
export function isLocalSingleFile(path: string): boolean {
  try {
    if (!statSync(path).isFile()) return false;
  } catch {
    return false;
  }
  return localFileInfo(path) !== undefined;
}

/**
 * Fail-closed admission for a local single-file dependency.
 *
 * Rejects symlinks (even when the link target is a regular file), unsupported
 * suffixes, non-file kinds, missing/malformed YAML frontmatter, and non-UTF-8
 * content.
 */
export function admitLocalFile(path: string): AdmittedLocalFile {
  let stats;
  try {
    stats = lstatSync(path);
  } catch (cause) {
    throw new ResolverError("RESOLVE_FAILED", `Local dependency path not found: ${path}`, {
      cause,
      details: { path },
    });
  }

  if (stats.isSymbolicLink()) {
    throw new ResolverError(
      "LOCAL_FILE_SYMLINK",
      `Local single-file dependency is a symlink: ${path}. Select a real file or use a directory package with in-package symlinks.`,
      { details: { path } },
    );
  }
  if (!stats.isFile()) {
    throw new ResolverError(
      "LOCAL_FILE_UNSUPPORTED",
      `Unsupported local source kind: ${path}. Select a regular primitive file or a directory package.`,
      { details: { path } },
    );
  }

  const info = localFileInfo(path);
  if (!info) {
    throw new ResolverError(
      "LOCAL_FILE_UNSUPPORTED",
      `Unsupported single-file dependency: ${basename(path)}. Use ${SUFFIXES.map(
        (s) => s.suffix,
      ).join(", ")}, or a directory package with a manifest.`,
      { details: { path } },
    );
  }

  let raw: Buffer;
  try {
    raw = readFileSync(path);
  } catch (cause) {
    throw new ResolverError("RESOLVE_FAILED", `Cannot read local single-file dependency: ${path}`, {
      cause,
      details: { path },
    });
  }

  let text: string;
  try {
    text = raw.toString("utf8");
  } catch (cause) {
    throw new ResolverError(
      "LOCAL_FILE_INVALID_FRONTMATTER",
      `Invalid primitive content in ${path}: expected UTF-8 Markdown.`,
      { cause, details: { path } },
    );
  }
  validateFrontmatter(text, path);

  return { ...info, path, content: raw };
}

function validateFrontmatter(text: string, path: string): void {
  const normalized = text.replace(/^\uFEFF/, "");
  const missing = () =>
    new ResolverError(
      "LOCAL_FILE_INVALID_FRONTMATTER",
      `Invalid primitive content in ${basename(path)}: missing YAML frontmatter. Add a leading "---" block, then rerun bapm install.`,
      { details: { path, reason: "missing_frontmatter" } },
    );

  if (!/^---[ \t]*\r?\n/.test(normalized)) throw missing();

  // Allows both an empty frontmatter block (`---\n---`) and a populated one.
  const match = /^---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/.exec(normalized);
  if (!match) throw missing();

  const block = match[1] ?? "";
  try {
    const parsed = loadYamlDocument(block, path);
    if (parsed !== null && (typeof parsed !== "object" || Array.isArray(parsed))) {
      throw new ResolverError(
        "LOCAL_FILE_INVALID_FRONTMATTER",
        `Invalid primitive content in ${basename(path)}: YAML frontmatter must be a mapping.`,
        { details: { path, reason: "frontmatter_not_mapping" } },
      );
    }
  } catch (cause) {
    if (cause instanceof ResolverError) throw cause;
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new ResolverError(
      "LOCAL_FILE_INVALID_FRONTMATTER",
      `Invalid primitive content in ${basename(path)}: ${message}. Use UTF-8 Markdown with valid YAML frontmatter.`,
      { cause, details: { path, reason: "invalid_frontmatter" } },
    );
  }
}

/**
 * Materialize APM's virtual-file package snapshot into `dest`:
 * `.apm/<subdirectory>/<filename>` plus a generated `apm.yml`.
 */
export function materializeLocalFileSnapshot(sourcePath: string, dest: string): LocalFileInfo {
  const admitted = admitLocalFile(sourcePath);
  rmSync(dest, { recursive: true, force: true });
  const primitiveDir = join(dest, ".apm", admitted.subdirectory);
  mkdirSync(primitiveDir, { recursive: true });
  writeFileSync(join(primitiveDir, admitted.filename), admitted.content);
  writeFileSync(
    join(dest, "apm.yml"),
    [
      `name: ${yamlString(admitted.filename)}`,
      "version: 1.0.0",
      `description: ${yamlString(`Virtual package containing ${admitted.filename}`)}`,
      "",
    ].join("\n"),
    "utf8",
  );
  return localFileInfo(admitted.path)!;
}

/**
 * Content hash for a local source. Directory sources keep the canonical tree
 * hash; single files hash the same virtual snapshot that install materializes,
 * so frozen/audit replay is stable without requiring `apm_modules`.
 */
export function computeLocalSourceContentHash(path: string): string {
  let isFile = false;
  try {
    isFile = statSync(path).isFile();
  } catch {
    isFile = false;
  }
  if (!isFile) return computeCanonicalTreeSha256(path);

  const tempRoot = mkdtempSync(join(tmpdir(), "bapm-local-file-"));
  try {
    const snapshot = join(tempRoot, "package");
    materializeLocalFileSnapshot(path, snapshot);
    return computeCanonicalTreeSha256(snapshot);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function yamlString(value: string): string {
  // JSON strings are valid YAML double-quoted scalars and safely escape names.
  return JSON.stringify(value);
}
