/**
 * Regression: merge-only archive-tree checks must not change replace-mode
 * (registry materialize) behaviour for malformed archives.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SafeExtractError, safeExtractZip } from "../../src/modules/Pack/safeExtract.ts";
import { buildStoredZip, utf8 } from "./safe-extract-fixtures.ts";

describe("safeExtractZip replace mode compatibility", () => {
  let root: string | undefined;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  function temp(): string {
    root = mkdtempSync(join(tmpdir(), "bapm-replace-compat-"));
    return root;
  }

  test("still extracts raw duplicate entries (last write wins)", () => {
    const base = temp();
    const dest = join(base, "out");
    const bytes = buildStoredZip([
      { name: "a.txt", data: utf8("first\n") },
      { name: "./a.txt", data: utf8("second\n") },
    ]);

    const result = safeExtractZip(bytes, dest);

    expect(result.filesExtracted).toBe(2);
    expect(readFileSync(join(dest, "a.txt"), "utf8")).toBe("second\n");
  });

  test("still fails late on archive-internal a + a/b.txt (EEXIST, dest untouched)", () => {
    const base = temp();
    const dest = join(base, "out");
    const bytes = buildStoredZip([
      { name: "a", data: utf8("file\n") },
      { name: "a/b.txt", data: utf8("nested\n") },
    ]);

    let error: unknown;
    try {
      safeExtractZip(bytes, dest);
    } catch (caught) {
      error = caught;
    }

    // Previous behaviour: staging write hits a raw EEXIST, not the merge pre-scan.
    expect(error).not.toBeInstanceOf(SafeExtractError);
    expect((error as NodeJS.ErrnoException).code).toBe("EEXIST");
    expect(existsSync(dest)).toBe(false);
    expect(readdirSync(base)).toEqual([]);
  });
});
