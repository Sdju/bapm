/**
 * Shared fail-closed zip safe-extract (sc-002): CD pre-scan for path escape,
 * symlink / non-regular unix types, entry + uncompressed caps; staging extract.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
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

const EOCD_SIG = 0x06054b50;
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
  if (
    type === S_IFIFO ||
    type === S_IFCHR ||
    type === S_IFBLK ||
    type === S_IFSOCK
  ) {
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

/**
 * Fail-closed extract into `dest` via same-filesystem staging + rename.
 * On any error, staging is removed and `dest` is not left as a half-write from this call.
 */
export function safeExtractZip(bytes: Uint8Array, dest: string): SafeExtractZipResult {
  const destRoot = resolve(dest);
  const entries = parseZipCentralDirectory(bytes);
  assertSafeZipCentralDirectory(entries);

  const parent = dirname(destRoot);
  mkdirSync(parent, { recursive: true });
  const staging = join(parent, `.bapm-safe-extract-${randomBytes(8).toString("hex")}`);

  mkdirSync(staging, { recursive: true });
  let promoted = false;
  try {
    let files: Record<string, Uint8Array>;
    try {
      files = unzipSync(bytes);
    } catch (cause) {
      throw new SafeExtractError("Failed to extract zip archive (corrupt or not a zip)", {
        cause,
      });
    }

    let count = 0;
    let inflatedBytes = 0;
    for (const [name, data] of Object.entries(files)) {
      if (!name || name.endsWith("/")) continue;
      const out = assertDestRelative(staging, name);
      inflatedBytes += data.byteLength;
      if (inflatedBytes > MAX_SAFE_UNCOMPRESSED_BYTES) {
        throw new SafeExtractError(
          `Refusing extract: uncompressed size exceeds 100 MB cap (${MAX_SAFE_UNCOMPRESSED_BYTES} bytes)`,
        );
      }
      count += 1;
      if (count > MAX_SAFE_ENTRIES) {
        throw new SafeExtractError(
          `Refusing extract: too many entries (cap ${MAX_SAFE_ENTRIES} / 10000)`,
        );
      }
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, data);
    }

    // Atomic-ish promote: remove previous dest then rename staging into place.
    rmSync(destRoot, { recursive: true, force: true });
    renameSync(staging, destRoot);
    promoted = true;
    return { filesExtracted: count, dest: destRoot };
  } catch (error) {
    if (!promoted) {
      rmSync(staging, { recursive: true, force: true });
    }
    throw error;
  }
}
