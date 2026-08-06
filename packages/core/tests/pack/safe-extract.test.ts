/**
 * Unit: shared safeExtractZip (symlink CD bit, caps, cleanup).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, deflateRawSync } from "node:zlib";
import {
  MAX_SAFE_ENTRIES,
  MAX_SAFE_UNCOMPRESSED_BYTES,
  SafeExtractError,
  parseZipCentralDirectory,
  safeExtractZip,
} from "../../src/modules/Pack/safeExtract.ts";
import { zipSync } from "fflate";

const ZIP_UNIX_SYMLINK_MODE = 0o120777;

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function buildStoredZip(
  members: Array<{ name: string; data: Uint8Array; unixMode?: number; deflate?: boolean }>,
): Uint8Array {
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
    lv.setUint16(4, 20, true);
    lv.setUint16(8, method, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, payload.length, true);
    lv.setUint32(22, uncompressed.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(payload, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20 | (createSystem << 8), true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, method, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, payload.length, true);
    cv.setUint32(24, uncompressed.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(38, externalAttr, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);
    offset += local.length;
  }

  const centralSize = centralParts.reduce((n, p) => n + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, members.length, true);
  ev.setUint16(10, members.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

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

describe("safeExtractZip", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  function temp(): string {
    cwd = mkdtempSync(join(tmpdir(), "bapm-safe-extract-"));
    return cwd;
  }

  test("parses unix symlink bit from CD external_attr", () => {
    const bytes = buildStoredZip([
      { name: "link", data: utf8("/tmp/x"), unixMode: ZIP_UNIX_SYMLINK_MODE },
    ]);
    const entries = parseZipCentralDirectory(bytes);
    expect(entries).toHaveLength(1);
    expect((entries[0]!.externalAttr >>> 16) & 0xf000).toBe(0xa000);
  });

  test("rejects symlink zip", () => {
    const root = temp();
    const dest = join(root, "out");
    const bytes = buildStoredZip([
      { name: "ok.txt", data: utf8("a") },
      { name: "evil", data: utf8("../x"), unixMode: ZIP_UNIX_SYMLINK_MODE },
    ]);
    expect(() => safeExtractZip(bytes, dest)).toThrow(SafeExtractError);
    expect(() => safeExtractZip(bytes, dest)).toThrow(/symlink/i);
    expect(existsSync(dest)).toBe(false);
  });

  test("rejects path escape and cleans staging", () => {
    const root = temp();
    const dest = join(root, "out");
    const bytes = buildStoredZip([
      { name: "safe.txt", data: utf8("a") },
      { name: "../../escape.txt", data: utf8("b") },
    ]);
    expect(() => safeExtractZip(bytes, dest)).toThrow(/path escape|\.\./i);
    expect(existsSync(dest)).toBe(false);
  });

  test("entry cap fails closed", () => {
    const root = temp();
    const dest = join(root, "out");
    const files: Record<string, Uint8Array> = {};
    const one = utf8("x");
    for (let i = 0; i < MAX_SAFE_ENTRIES + 1; i += 1) {
      files[`f/${i}.txt`] = one;
    }
    const bytes = zipSync(files, { level: 0 });
    expect(() => safeExtractZip(bytes, dest)).toThrow(/entr(y|ies)|10000|too many/i);
    expect(existsSync(dest)).toBe(false);
  });

  test("size cap fails closed", () => {
    const root = temp();
    const dest = join(root, "out");
    const bytes = buildStoredZip([
      {
        name: "huge.bin",
        data: new Uint8Array(MAX_SAFE_UNCOMPRESSED_BYTES + 1),
        deflate: true,
      },
    ]);
    expect(() => safeExtractZip(bytes, dest)).toThrow(/size|100\s*MB|uncompressed/i);
    expect(existsSync(dest)).toBe(false);
  });

  test("safe regular zip extracts", () => {
    const root = temp();
    const dest = join(root, "out");
    const bytes = buildStoredZip([
      { name: "apm.yml", data: utf8("name: x\nversion: 1.0.0\n") },
      { name: "nested/a.txt", data: utf8("ok\n") },
    ]);
    const result = safeExtractZip(bytes, dest);
    expect(result.filesExtracted).toBe(2);
    expect(readFileSync(join(dest, "apm.yml"), "utf8")).toContain("name: x");
    expect(readFileSync(join(dest, "nested/a.txt"), "utf8")).toBe("ok\n");
  });
});
