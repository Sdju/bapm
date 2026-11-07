/**
 * Shared fail-closed zip safe-extract (sc-002): CD pre-scan for path escape,
 * symlink / non-regular unix types, entry + uncompressed caps; staging extract.
 */
import { randomBytes } from "node:crypto";
import {
  constants,
  copyFileSync,
  linkSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { unzipSync } from "fflate";

export const MAX_SAFE_ENTRIES = 10_000;
export const MAX_SAFE_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;

const S_IFMT = 0xf000;
const S_IFIFO = 0x1000;
const S_IFCHR = 0x2000;
const S_IFDIR = 0x4000;
const S_IFBLK = 0x6000;
const S_IFREG = 0x8000;
const S_IFLNK = 0xa000;
const S_IFSOCK = 0xc000;

const CD_SIG = 0x02014b50;

export class SafeExtractError extends Error {
  readonly path?: string;

  constructor(message: string, options?: { path?: string; cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "SafeExtractError";
    this.path = options?.path;
  }
}

export type ZipCdEntry = {
  name: string;
  uncompressedSize: number;
  compressedSize: number;
  externalAttr: number;
  createSystem: number;
  isDirectory: boolean;
};

function readUtf8(bytes: Uint8Array, offset: number, length: number): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(offset, offset + length));
}

function findEocdOffset(bytes: Uint8Array): number {
  // EOCD is at least 22 bytes; comment can be up to 65535.
  const min = Math.max(0, bytes.length - (22 + 65535));
  for (let i = bytes.length - 22; i >= min; i -= 1) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      return i;
    }
  }
  throw new SafeExtractError("Refusing extract: not a valid zip archive (missing EOCD)");
}

/**
 * Parse zip central-directory entries (names, sizes, unix external_attr).
 */
export function parseZipCentralDirectory(bytes: Uint8Array): ZipCdEntry[] {
  if (bytes.length < 22) {
    throw new SafeExtractError("Refusing extract: not a valid zip archive");
  }
  const eocd = findEocdOffset(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const totalEntries = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);

  if (cdOffset + cdSize > bytes.length) {
    throw new SafeExtractError("Refusing extract: corrupt zip central directory");
  }

  const entries: ZipCdEntry[] = [];
  let offset = cdOffset;
  const cdEnd = cdOffset + cdSize;

  for (let i = 0; i < totalEntries; i += 1) {
    if (offset + 46 > cdEnd) {
      throw new SafeExtractError("Refusing extract: truncated zip central directory");
    }
    if (view.getUint32(offset, true) !== CD_SIG) {
      throw new SafeExtractError("Refusing extract: corrupt zip central directory entry");
    }
    const versionMadeBy = view.getUint16(offset + 4, true);
    const createSystem = (versionMadeBy >>> 8) & 0xff;
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const externalAttr = view.getUint32(offset + 38, true);
    const name = readUtf8(bytes, offset + 46, nameLen);
    const isDirectory = name.endsWith("/") || ((externalAttr >>> 16) & S_IFMT) === S_IFDIR;

    entries.push({
      name,
      uncompressedSize,
      compressedSize,
      externalAttr,
      createSystem,
      isDirectory,
    });

    offset += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

function unixModeOf(entry: ZipCdEntry): number {
  return (entry.externalAttr >>> 16) & 0xffff;
}

function assertSafeEntryPath(name: string): void {
  if (!name) {
    throw new SafeExtractError("Refusing unsafe archive entry: empty name");
  }
  const normalized = name.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) {
    throw new SafeExtractError(`Refusing absolute archive entry: ${name}`, { path: name });
  }
  if (normalized.split("/").includes("..")) {
    throw new SafeExtractError(`Refusing path escape for archive entry: ${name}`, { path: name });
  }
}

function assertSafeUnixType(entry: ZipCdEntry): void {
  const mode = unixModeOf(entry);
  const type = mode & S_IFMT;
  if (type === 0) return; // no unix type advertised
  if (type === S_IFREG || type === S_IFDIR) return;
  if (type === S_IFLNK) {
    throw new SafeExtractError(
      `Refusing symlink archive entry: ${entry.name} (unix mode 0x${type.toString(16)})`,
      { path: entry.name },
    );
  }
  if (type === S_IFIFO || type === S_IFCHR || type === S_IFBLK || type === S_IFSOCK) {
    throw new SafeExtractError(
      `Refusing non-regular archive entry: ${entry.name} (unix mode 0x${type.toString(16)})`,
      { path: entry.name },
    );
  }
}

/**
 * Pre-scan CD: paths, symlink/non-regular, entry + size caps (fail before write).
 */
export function assertSafeZipCentralDirectory(entries: ZipCdEntry[]): void {
  let fileCount = 0;
  let totalUncompressed = 0;

  for (const entry of entries) {
    assertSafeEntryPath(entry.name);
    assertSafeUnixType(entry);
    if (entry.isDirectory) continue;
    fileCount += 1;
    totalUncompressed += entry.uncompressedSize;
    if (fileCount > MAX_SAFE_ENTRIES) {
      throw new SafeExtractError(
        `Refusing extract: too many entries (cap ${MAX_SAFE_ENTRIES} / 10000)`,
      );
    }
    if (totalUncompressed > MAX_SAFE_UNCOMPRESSED_BYTES) {
      throw new SafeExtractError(
        `Refusing extract: uncompressed size exceeds 100 MB cap (${MAX_SAFE_UNCOMPRESSED_BYTES} bytes)`,
      );
    }
  }

  if (fileCount > MAX_SAFE_ENTRIES) {
    throw new SafeExtractError(
      `Refusing extract: too many entries (cap ${MAX_SAFE_ENTRIES} / 10000)`,
    );
  }
  if (totalUncompressed > MAX_SAFE_UNCOMPRESSED_BYTES) {
    throw new SafeExtractError(
      `Refusing extract: uncompressed size exceeds 100 MB cap (${MAX_SAFE_UNCOMPRESSED_BYTES} bytes)`,
    );
  }
}

function assertDestRelative(destRoot: string, memberName: string): string {
  const normalized = memberName.replace(/\\/g, "/");
  assertSafeEntryPath(normalized);
  const out = resolve(destRoot, normalized);
  const rel = relative(destRoot, out);
  if (rel.startsWith("..") || rel === ".." || rel === "") {
    throw new SafeExtractError(`Refusing path escape for archive entry: ${memberName}`, {
      path: memberName,
    });
  }
  return out;
}

export type SafeExtractZipResult = {
  filesExtracted: number;
  dest: string;
};

export type SafeExtractZipOptions = {
  /**
   * `replace` (default): `dest` is a bapm-owned cache dir and is swapped for the archive tree.
   * `merge`: `dest` holds user files; members are added in place, nothing else is touched,
   * and a member that would overwrite different bytes fails closed before any write.
   */
  mode?: "replace" | "merge";
};

type InflatedMember = { name: string; relPath: string; data: Uint8Array };

/** Canonical archive path: `\` -> `/`, no empty or `.` segments. */
function normalizeArchivePath(name: string): string {
  return name
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment !== "" && segment !== ".")
    .join("/");
}

/**
 * Reject duplicate normalized member paths and file-vs-directory collisions
 * inside the archive itself (e.g. `a` + `a/b.txt`) before any write. Merge-only:
 * replace mode keeps its previous permissive behaviour for malformed archives.
 * `unzipSync` keys members by raw name, so `a.txt` and `./a.txt` would otherwise
 * collapse into one member and silently drop the other.
 *
 * Classification matches extraction: only a trailing `/` makes a directory.
 * An S_IFDIR entry without a slash is extracted as a zero-byte file, so it is
 * treated as a file here too.
 */
function assertArchiveTreeConsistent(entries: ZipCdEntry[]): void {
  const files = new Set<string>();
  const dirs = new Set<string>();

  for (const entry of entries) {
    const key = normalizeArchivePath(entry.name);
    if (!key) continue;
    if (entry.name.endsWith("/")) {
      dirs.add(key);
      continue;
    }
    if (files.has(key)) {
      throw new SafeExtractError(`Refusing extract: duplicate archive entry path: ${key}`, {
        path: key,
      });
    }
    files.add(key);
  }

  for (const path of new Set([...files, ...dirs])) {
    if (files.has(path) && dirs.has(path)) {
      throw new SafeExtractError(
        `Refusing extract: archive entry ${path} is both a file and a directory`,
        { path },
      );
    }
    const segments = path.split("/");
    for (let i = 1; i < segments.length; i += 1) {
      const ancestor = segments.slice(0, i).join("/");
      if (files.has(ancestor)) {
        throw new SafeExtractError(
          `Refusing extract: archive entry ${ancestor} conflicts with ${path} (file vs directory)`,
          { path: ancestor },
        );
      }
    }
  }
}

function inflateSafeMembers(
  bytes: Uint8Array,
  destRoot: string,
  mode: "replace" | "merge",
): InflatedMember[] {
  const entries = parseZipCentralDirectory(bytes);
  assertSafeZipCentralDirectory(entries);
  if (mode === "merge") assertArchiveTreeConsistent(entries);

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch (cause) {
    throw new SafeExtractError("Failed to extract zip archive (corrupt or not a zip)", {
      cause,
    });
  }

  const members: InflatedMember[] = [];
  let inflatedBytes = 0;
  for (const [name, data] of Object.entries(files)) {
    if (!name || name.endsWith("/")) continue;
    const out = assertDestRelative(destRoot, name);
    inflatedBytes += data.byteLength;
    if (inflatedBytes > MAX_SAFE_UNCOMPRESSED_BYTES) {
      throw new SafeExtractError(
        `Refusing extract: uncompressed size exceeds 100 MB cap (${MAX_SAFE_UNCOMPRESSED_BYTES} bytes)`,
      );
    }
    if (members.length + 1 > MAX_SAFE_ENTRIES) {
      throw new SafeExtractError(
        `Refusing extract: too many entries (cap ${MAX_SAFE_ENTRIES} / 10000)`,
      );
    }
    members.push({ name, relPath: relative(destRoot, out), data });
  }
  return members;
}

/**
 * Fail-closed extract into `dest`. See {@link SafeExtractZipOptions} for modes.
 * On any error, `dest` is not left as a half-write from this call.
 */
export function safeExtractZip(
  bytes: Uint8Array,
  dest: string,
  options: SafeExtractZipOptions = {},
): SafeExtractZipResult {
  const destRoot = resolve(dest);
  const mode = options.mode === "merge" ? "merge" : "replace";
  const members = inflateSafeMembers(bytes, destRoot, mode);
  if (mode === "merge") return mergeMembers(members, destRoot);
  return replaceWithMembers(members, destRoot);
}

function replaceWithMembers(members: InflatedMember[], destRoot: string): SafeExtractZipResult {
  const parent = dirname(destRoot);
  mkdirSync(parent, { recursive: true });
  const staging = join(parent, `.bapm-safe-extract-${randomBytes(8).toString("hex")}`);

  mkdirSync(staging, { recursive: true });
  let promoted = false;
  try {
    for (const member of members) {
      const out = join(staging, member.relPath);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, member.data);
    }

    // Atomic-ish promote: remove previous dest then rename staging into place.
    rmSync(destRoot, { recursive: true, force: true });
    renameSync(staging, destRoot);
    promoted = true;
    return { filesExtracted: members.length, dest: destRoot };
  } catch (error) {
    if (!promoted) {
      rmSync(staging, { recursive: true, force: true });
    }
    throw error;
  }
}

function errnoCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as NodeJS.ErrnoException).code)
    : undefined;
}

/** `lstat`, with only ENOENT meaning "absent". Other errors are real problems. */
function lstatIfExists(path: string): ReturnType<typeof lstatSync> | undefined {
  try {
    return lstatSync(path);
  } catch (error) {
    if (errnoCode(error) === "ENOENT") return undefined;
    throw error;
  }
}

/** Why `relPath` cannot be written in place, or undefined when it can (absent or identical). */
function mergeConflict(destRoot: string, relPath: string, data: Uint8Array): string | undefined {
  const segments = relPath.split(sep);
  let current = destRoot;
  for (let i = 0; i < segments.length; i += 1) {
    current = join(current, segments[i]!);
    let stat;
    try {
      stat = lstatSync(current);
    } catch (error) {
      if (errnoCode(error) === "ENOENT") return undefined;
      return `cannot be inspected (${errnoCode(error) ?? "unknown error"})`;
    }
    if (stat.isSymbolicLink()) return "is a symlink";
    const isLeaf = i === segments.length - 1;
    if (!isLeaf && !stat.isDirectory()) return "has a file where a directory is needed";
    if (isLeaf) {
      if (!stat.isFile()) return "is not a regular file";
      // Size check first: only read files that could possibly be identical.
      if (stat.size !== data.byteLength) return "already exists with different content";
      let existing: Buffer;
      try {
        existing = readFileSync(current);
      } catch (error) {
        return `cannot be read (${errnoCode(error) ?? "unknown error"})`;
      }
      return existing.equals(data) ? undefined : "already exists with different content";
    }
  }
  return undefined;
}

/**
 * Create `dir` and record every directory this call actually creates, shallowest
 * first (rollback walks the list in reverse). Pre-existing dirs are never tracked.
 */
function ensureDirTracked(dir: string, createdDirs: string[]): void {
  const missing: string[] = [];
  let current = dir;
  while (lstatIfExists(current) === undefined) {
    missing.push(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  // Create shallowest first so a mid-chain failure still leaves every created
  // dir tracked for rollback.
  for (let i = missing.length - 1; i >= 0; i -= 1) {
    const path = missing[i]!;
    try {
      mkdirSync(path);
      createdDirs.push(path);
    } catch (error) {
      if (errnoCode(error) === "EEXIST") continue; // created concurrently; not ours
      throw error;
    }
  }
}

const COPY_FALLBACK_CODES = new Set(["EPERM", "ENOSYS", "EOPNOTSUPP", "EXDEV"]);

/**
 * Create `out` only when it does not exist yet. The payload is first written to a
 * temp file in the same directory, then atomically hard-linked into place, so a
 * concurrent creation still fails with EEXIST instead of being overwritten.
 * Filesystems without hard links fall back to COPYFILE_EXCL.
 */
function writeFileExclusive(out: string, data: Uint8Array, createdFiles: string[]): void {
  const tmp = join(dirname(out), `.bapm-extract-${randomBytes(8).toString("hex")}.tmp`);
  // Track the temp path before writing: a failed write can leave a partial file.
  createdFiles.push(tmp);
  try {
    writeFileSync(tmp, data, { flag: "wx" });
  } catch (error) {
    if (errnoCode(error) === "EEXIST") createdFiles.pop(); // not created by us
    throw error;
  }
  try {
    try {
      linkSync(tmp, out);
    } catch (error) {
      const code = errnoCode(error);
      if (code === "EEXIST") {
        throw new SafeExtractError(`Refusing to overwrite existing file: ${out}`, {
          path: out,
          cause: error,
        });
      }
      if (code === undefined || !COPY_FALLBACK_CODES.has(code)) throw error;
      // No hard-link support (FAT/exFAT, some network mounts): copy-exclusive.
      createdFiles.push(out);
      try {
        copyFileSync(tmp, out, constants.COPYFILE_EXCL);
      } catch (copyError) {
        if (errnoCode(copyError) === "EEXIST") {
          // The target appeared after the pre-scan and was not created by us.
          createdFiles.pop();
          throw new SafeExtractError(`Refusing to overwrite existing file: ${out}`, {
            path: out,
            cause: copyError,
          });
        }
        throw copyError;
      }
      return;
    }
    createdFiles.push(out);
  } finally {
    rmSync(tmp, { force: true });
  }
}

function rollbackCreated(createdFiles: string[], createdDirs: string[]): void {
  for (let i = createdFiles.length - 1; i >= 0; i -= 1) {
    try {
      rmSync(createdFiles[i]!, { force: true });
    } catch {
      // Best effort: the original write error is the actionable failure.
    }
  }
  for (let i = createdDirs.length - 1; i >= 0; i -= 1) {
    try {
      rmdirSync(createdDirs[i]!);
    } catch {
      // Best effort: only remove dirs this call created and left empty.
    }
  }
}

function mergeMembers(members: InflatedMember[], destRoot: string): SafeExtractZipResult {
  const conflicts: Array<{ name: string; reason: string }> = [];
  for (const member of members) {
    const reason = mergeConflict(destRoot, member.relPath, member.data);
    if (reason) conflicts.push({ name: member.name, reason });
  }
  if (conflicts.length > 0) {
    const shown = conflicts
      .slice(0, 5)
      .map((c) => `${c.name} (${c.reason})`)
      .join(", ");
    const more = conflicts.length > 5 ? ` and ${conflicts.length - 5} more` : "";
    throw new SafeExtractError(
      `Refusing to overwrite existing files: ${shown}${more}. Extract into an empty directory.`,
      { path: conflicts[0]!.name },
    );
  }

  const createdFiles: string[] = [];
  const createdDirs: string[] = [];
  try {
    ensureDirTracked(destRoot, createdDirs);
    for (const member of members) {
      const out = join(destRoot, member.relPath);
      const existing = lstatIfExists(out);
      if (existing) {
        if (existing.isFile()) continue; // identical, confirmed by the pre-scan
        throw new SafeExtractError(`Refusing to overwrite non-regular file: ${member.name}`, {
          path: member.name,
        });
      }
      ensureDirTracked(dirname(out), createdDirs);
      writeFileExclusive(out, member.data, createdFiles);
    }
    return { filesExtracted: members.length, dest: destRoot };
  } catch (error) {
    rollbackCreated(createdFiles, createdDirs);
    throw error;
  }
}
