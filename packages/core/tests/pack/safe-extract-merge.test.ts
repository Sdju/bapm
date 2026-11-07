/**
 * Unit: safeExtractZip merge-mode pre-scan guarantees and rollback cleanup.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SafeExtractError, safeExtractZip } from "../../src/modules/Pack/safeExtract.ts";
import { buildStoredZip, utf8 } from "./safe-extract-fixtures.ts";

describe("safeExtractZip merge mode", () => {
  let root: string | undefined;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  function temp(): string {
    root = mkdtempSync(join(tmpdir(), "bapm-merge-safety-"));
    return root;
  }

  test("duplicate normalized archive paths fail closed before any write", () => {
    const base = temp();
    const dest = join(base, "out");
    const bytes = buildStoredZip([
      { name: "a.txt", data: utf8("first\n") },
      { name: "./a.txt", data: utf8("second\n") },
    ]);

    let error: unknown;
    try {
      safeExtractZip(bytes, dest, { mode: "merge" });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(SafeExtractError);
    expect((error as Error).message).toMatch(/duplicate/i);
    expect((error as Error).message).toContain("a.txt");
    expect(existsSync(dest)).toBe(false);
    expect(readdirSync(base)).toEqual([]);
  });

  test("archive-internal file-vs-directory conflict fails closed before any write", () => {
    const base = temp();
    const dest = join(base, "out");
    const bytes = buildStoredZip([
      { name: "a", data: utf8("file\n") },
      { name: "a/b.txt", data: utf8("nested\n") },
    ]);

    let error: unknown;
    try {
      safeExtractZip(bytes, dest, { mode: "merge" });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(SafeExtractError);
    expect((error as Error).message).toContain("a conflicts with a/b.txt");
    expect(existsSync(dest)).toBe(false);
    expect(readdirSync(base)).toEqual([]);
  });

  test("S_IFDIR entry without trailing slash is checked as a file, like extraction", () => {
    const base = temp();
    const dest = join(base, "out");
    const bytes = buildStoredZip([
      { name: "a", data: utf8(""), unixMode: 0o040755 },
      { name: "a/b.txt", data: utf8("nested\n") },
    ]);

    let error: unknown;
    try {
      safeExtractZip(bytes, dest, { mode: "merge" });
    } catch (caught) {
      error = caught;
    }

    // Extraction treats a slash-less S_IFDIR member as a zero-byte file, so the
    // pre-scan must see the same file-vs-directory collision.
    expect(error).toBeInstanceOf(SafeExtractError);
    expect((error as Error).message).toContain("a conflicts with a/b.txt");
    expect(existsSync(dest)).toBe(false);
    expect(readdirSync(base)).toEqual([]);
  });

  test("conflict member placed last still writes nothing", () => {
    const base = temp();
    const dest = join(base, "out");
    mkdirSync(dest);
    writeFileSync(join(dest, "conflict.txt"), "existing\n");
    const bytes = buildStoredZip([
      { name: "first.txt", data: utf8("new\n") },
      { name: "nested/second.txt", data: utf8("new\n") },
      { name: "conflict.txt", data: utf8("different\n") },
    ]);

    expect(() => safeExtractZip(bytes, dest, { mode: "merge" })).toThrow(SafeExtractError);
    expect(() => safeExtractZip(bytes, dest, { mode: "merge" })).toThrow(/conflict\.txt/);

    // Pre-scan proves this: members before the conflicting one were not written.
    expect(existsSync(join(dest, "first.txt"))).toBe(false);
    expect(existsSync(join(dest, "nested"))).toBe(false);
    expect(readFileSync(join(dest, "conflict.txt"), "utf8")).toBe("existing\n");
    expect(readdirSync(dest)).toEqual(["conflict.txt"]);
  });

  test("unreadable existing paths are conflicts, not treated as absent", () => {
    if (process.platform === "win32" || process.getuid?.() === 0) return;

    const base = temp();
    const dest = join(base, "out");
    mkdirSync(dest);
    const blocked = join(dest, "blocked");
    mkdirSync(blocked);
    chmodSync(blocked, 0o000);
    try {
      const bytes = buildStoredZip([{ name: "blocked/file.txt", data: utf8("x\n") }]);

      expect(() => safeExtractZip(bytes, dest, { mode: "merge" })).toThrow(SafeExtractError);
      expect(() => safeExtractZip(bytes, dest, { mode: "merge" })).toThrow(
        /cannot be inspected|EACCES/i,
      );
      expect(readdirSync(dest)).toEqual(["blocked"]);
    } finally {
      chmodSync(blocked, 0o700);
    }
    expect(existsSync(join(blocked, "file.txt"))).toBe(false);
  });

  test("rolls back files and created directories on a write failure", () => {
    if (process.platform === "win32" || process.getuid?.() === 0) return;

    const base = temp();
    const dest = join(base, "out");
    mkdirSync(dest);
    const locked = join(dest, "locked");
    mkdirSync(locked);
    writeFileSync(join(locked, "keep.txt"), "keep\n");
    chmodSync(locked, 0o500);
    try {
      const bytes = buildStoredZip([
        { name: "fresh/sub/ok.txt", data: utf8("ok\n") },
        { name: "locked/denied.txt", data: utf8("denied\n") },
      ]);

      expect(() => safeExtractZip(bytes, dest, { mode: "merge" })).toThrow();

      expect(existsSync(join(dest, "fresh"))).toBe(false);
      expect(existsSync(join(dest, "fresh", "sub"))).toBe(false);
      expect(readFileSync(join(locked, "keep.txt"), "utf8")).toBe("keep\n");
      expect(existsSync(join(locked, "denied.txt"))).toBe(false);
      expect(readdirSync(dest).sort()).toEqual(["locked"]);
    } finally {
      chmodSync(locked, 0o700);
    }
  });

  test("removes a destRoot created by the call when a later write fails", () => {
    const base = temp();
    const dest = join(base, "out");
    // A single path component over NAME_MAX (255 on Linux/ext4). The pre-scan
    // sees ENOENT because dest does not exist yet; the write then fails.
    const longName = `${"a".repeat(300)}.txt`;
    try {
      writeFileSync(join(base, longName), "probe\n");
      rmSync(join(base, longName));
      return; // filesystem accepts long names; no portable failure available
    } catch {
      // expected on ext4-style filesystems
    }

    const bytes = buildStoredZip([{ name: longName, data: utf8("x\n") }]);
    expect(() => safeExtractZip(bytes, dest, { mode: "merge" })).toThrow();
    expect(existsSync(dest)).toBe(false);
    expect(readdirSync(base)).toEqual([]);
  });
});
