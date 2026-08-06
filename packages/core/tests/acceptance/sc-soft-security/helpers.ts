/**
 * Helpers for sc-soft-security acceptance (RED until apply).
 * Soft-resolve Pack extract / Registry materialize / Manifest parse from @bapm/core.
 */
import * as core from "@bapm/core";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateRawSync } from "node:zlib";
import { parse as parseYaml } from "yaml";
import { zipSync } from "fflate";

export const suiteDir = dirname(fileURLToPath(import.meta.url));
export const coreRoot = resolve(suiteDir, "../../..");
export const repoRoot = resolve(coreRoot, "../..");
export const checklistPath = join(repoRoot, "tests/spec-conformance/checklist.yml");

export const MAX_SAFE_ENTRIES = 10_000;
export const MAX_SAFE_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;

/** Symlink unix mode (S_IFLNK | 0777) — APM-compatible `0xA000` type bit. */
export const ZIP_UNIX_SYMLINK_MODE = 0o120777;

export type TempDir = { cwd: string; cleanup: () => void };

export function createTempDir(prefix = "bapm-sc-soft-"): TempDir {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function writeBytes(path: string, bytes: Uint8Array): string {
  ensureDir(dirname(path));
  writeFileSync(path, bytes);
  return path;
}

export function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function sha256Hex(content: string | Uint8Array | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function sha256Digest(content: string | Uint8Array | Buffer): string {
  return `sha256:${sha256Hex(content)}`;
}

type AnyFn = (...args: never[]) => unknown;

export function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @bapm/core to export one of [${names.join(", ")}] (${label})`);
}

export function getExtractPackArchive(): (
  options: Record<string, unknown>,
) => Promise<unknown> | unknown {
  return pickExport(["extractPackArchive", "unpackArchive", "extractPack"], "Pack extract") as (
    options: Record<string, unknown>,
  ) => Promise<unknown> | unknown;
}

export function getMaterializeRegistryArchive(): (options: {
  cwd: string;
  dest: string;
  bytes: Uint8Array;
  expectedDigest: string;
  label?: string;
}) => void {
  return pickExport(
    ["materializeRegistryArchive", "materializeRegistryPackage"],
    "Registry materialize",
  ) as (options: {
    cwd: string;
    dest: string;
    bytes: Uint8Array;
    expectedDigest: string;
    label?: string;
  }) => void;
}

export function getParseManifest(): (input: unknown) => Record<string, unknown> {
  return pickExport(["parseManifest"], "parseManifest") as (
    input: unknown,
  ) => Record<string, unknown>;
}

export function listRelativeFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (d: string, prefix = "") => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      if (statSync(p).isDirectory()) walk(p, rel);
      else out.push(rel);
    }
  };
  walk(root);
  return out.sort();
}

export async function expectRejectsMatching(
  fn: () => unknown | Promise<unknown>,
  pattern: RegExp,
): Promise<unknown> {
  let thrown: unknown;
  try {
    await fn();
  } catch (e) {
    thrown = e;
  }
  expectThrown(thrown, pattern);
  return thrown;
}

export function expectThrowsMatching(fn: () => unknown, pattern: RegExp): unknown {
  let thrown: unknown;
  try {
    fn();
  } catch (e) {
    thrown = e;
  }
  expectThrown(thrown, pattern);
  return thrown;
}

function expectThrown(thrown: unknown, pattern: RegExp): void {
  if (thrown === undefined) {
    throw new Error(`expected throw matching ${pattern}`);
  }
  const msg =
    thrown instanceof Error
      ? thrown.message
      : typeof thrown === "object" && thrown && "message" in thrown
        ? String((thrown as { message: unknown }).message)
        : String(thrown);
  if (!pattern.test(msg)) {
    throw new Error(`expected message matching ${pattern}, got: ${msg}`);
  }
}

export type ZipMember = {
  name: string;
  data: Uint8Array;
  /** Unix st_mode (16-bit). When set, create_system=3 and external_attr = mode << 16. */
  unixMode?: number;
  /** When true, DEFLATE payload (raw zlib without zlib wrapper — zip uses raw deflate). */
  deflate?: boolean;
};

/**
 * Minimal zip with optional unix symlink/external_attr bits
 * (fflate zipSync does not expose ZipInfo-level symlink metadata).
 */
export function buildStoredZip(members: ZipMember[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const member of members) {
    const nameBytes = utf8(member.name);
    const uncompressed = member.data;
    const useDeflate = member.deflate === true;
    const payload = useDeflate
      ? new Uint8Array(deflateRawSync(uncompressed, { level: 9 }))
      : uncompressed;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(uncompressed) >>> 0;
    const createSystem = member.unixMode !== undefined ? 3 : 0;
    const externalAttr =
      member.unixMode !== undefined ? ((member.unixMode & 0xffff) << 16) >>> 0 : 0;

    const local = new Uint8Array(30 + nameBytes.length + payload.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0, true); // flags
    lv.setUint16(8, method, true);
    lv.setUint16(10, 0, true); // time
    lv.setUint16(12, 0, true); // date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, payload.length, true);
    lv.setUint32(22, uncompressed.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // extra len
    local.set(nameBytes, 30);
    local.set(payload, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    // version made by: low byte = zip version, high byte = create system (3 = Unix)
    cv.setUint16(4, 20 | (createSystem << 8), true);
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0, true); // flags
    cv.setUint16(10, method, true);
    cv.setUint16(12, 0, true); // time
    cv.setUint16(14, 0, true); // date
    cv.setUint32(16, crc, true);
    cv.setUint32(20, payload.length, true);
    cv.setUint32(24, uncompressed.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); // extra
    cv.setUint16(32, 0, true); // comment
    cv.setUint16(34, 0, true); // disk start
    cv.setUint16(36, 0, true); // int attr
    cv.setUint32(38, externalAttr, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);

    offset += local.length;
  }

  const centralSize = centralParts.reduce((n, p) => n + p.length, 0);
  const centralOffset = offset;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, members.length, true);
  ev.setUint16(10, members.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  ev.setUint16(20, 0, true);

  const total =
    localParts.reduce((n, p) => n + p.length, 0) +
    centralParts.reduce((n, p) => n + p.length, 0) +
    eocd.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of localParts) {
    out.set(p, o);
    o += p.length;
  }
  for (const p of centralParts) {
    out.set(p, o);
    o += p.length;
  }
  out.set(eocd, o);
  return out;
}

/** Regular-file zip with optional path-escape / absolute members (STORED). */
export function buildZipWithPaths(paths: Array<{ name: string; contents?: string }>): Uint8Array {
  return buildStoredZip(
    paths.map((p) => ({
      name: p.name,
      data: utf8(p.contents ?? "payload\n"),
    })),
  );
}

/** Zip containing a unix symlink member (external_attr symlink bit). */
export function buildSymlinkZip(options?: {
  linkName?: string;
  target?: string;
  companionFile?: { name: string; contents: string };
}): Uint8Array {
  const members: ZipMember[] = [];
  if (options?.companionFile) {
    members.push({
      name: options.companionFile.name,
      data: utf8(options.companionFile.contents),
    });
  }
  members.push({
    name: options?.linkName ?? "evil-link",
    data: utf8(options?.target ?? "/tmp/evil-target"),
    unixMode: ZIP_UNIX_SYMLINK_MODE,
  });
  return buildStoredZip(members);
}

/** Safe then unsafe (dot-dot) — for cleanup-after-partial-write assertions. */
export function buildPartialThenEscapeZip(): Uint8Array {
  return buildStoredZip([
    { name: "safe/ok.txt", data: utf8("kept-until-fail\n") },
    { name: "../../escape.txt", data: utf8("should-not-land\n") },
  ]);
}

/** Safe file then symlink — cleanup when symlink reject fires mid-stream. */
export function buildPartialThenSymlinkZip(): Uint8Array {
  return buildStoredZip([
    { name: "safe/ok.txt", data: utf8("kept-until-fail\n") },
    {
      name: "link-out",
      data: utf8("../outside"),
      unixMode: ZIP_UNIX_SYMLINK_MODE,
    },
  ]);
}

/** Entry-count over cap (10_001 tiny files). */
export function buildOverEntryCapZip(count = MAX_SAFE_ENTRIES + 1): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const one = utf8("x");
  for (let i = 0; i < count; i += 1) {
    files[`f/${i}.txt`] = one;
  }
  return zipSync(files, { level: 0 });
}

/**
 * Uncompressed payload over 100 MB (zeros + DEFLATE → small archive).
 * CD/local uncompressed sizes reflect the real inflated byte count.
 */
export function buildOverSizeCapZip(
  uncompressedBytes = MAX_SAFE_UNCOMPRESSED_BYTES + 1024,
): Uint8Array {
  return buildStoredZip([
    {
      name: "huge.bin",
      data: new Uint8Array(uncompressedBytes),
      deflate: true,
    },
  ]);
}

/** Minimal valid regular zip under caps (positive control). */
export function buildSafeRegularZip(): Uint8Array {
  return buildStoredZip([
    { name: "apm.yml", data: utf8('name: demo/pkg\nversion: "1.0.0"\n') },
    { name: ".apm/keep.txt", data: utf8("ok\n") },
  ]);
}

export type ChecklistRow = {
  id: string;
  status: string;
  rationale?: string;
  citations?: string[];
};

export function loadChecklistRows(): ChecklistRow[] {
  const raw = parseYaml(readFileSync(checklistPath, "utf8")) as {
    requirements?: ChecklistRow[];
  };
  return raw.requirements ?? [];
}

export function byId(rows: ChecklistRow[], id: string): ChecklistRow {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`checklist missing ${id}`);
  return row;
}
