/**
 * sc-002 / G1–G6 — Pack extractPackArchive safe-extract acceptance (RED until apply).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import {
  MAX_SAFE_ENTRIES,
  MAX_SAFE_UNCOMPRESSED_BYTES,
  buildOverEntryCapZip,
  buildOverSizeCapZip,
  buildPartialThenEscapeZip,
  buildPartialThenSymlinkZip,
  buildSafeRegularZip,
  buildSymlinkZip,
  buildZipWithPaths,
  createTempDir,
  expectRejectsMatching,
  getExtractPackArchive,
  listRelativeFiles,
  writeBytes,
  type TempDir,
} from "./helpers.ts";

describe("sc-soft-security Pack safe-extract", () => {
  let tmp: TempDir | undefined;

  afterEach(() => {
    tmp?.cleanup();
    tmp = undefined;
  });

  test("symlink zip member is rejected fail-closed (G1)", async () => {
    tmp = createTempDir();
    const archivePath = writeBytes(join(tmp.cwd, "symlink.zip"), buildSymlinkZip());
    const outputDir = join(tmp.cwd, "out");

    await expectRejectsMatching(
      () => getExtractPackArchive()({ archivePath, outputDir }),
      /symlink|symbolic|unsafe|link|refusing/i,
    );

    expect(listRelativeFiles(outputDir)).toEqual([]);
  });

  test("dot-dot path escape is rejected (G1 path)", async () => {
    tmp = createTempDir();
    const archivePath = writeBytes(
      join(tmp.cwd, "escape.zip"),
      buildZipWithPaths([{ name: "../../etc/passwd", contents: "x\n" }]),
    );
    const outputDir = join(tmp.cwd, "out");

    await expectRejectsMatching(
      () => getExtractPackArchive()({ archivePath, outputDir }),
      /unsafe|path.?escape|refusing|\.\./i,
    );
  });

  test("absolute archive entry is rejected", async () => {
    tmp = createTempDir();
    const archivePath = writeBytes(
      join(tmp.cwd, "abs.zip"),
      buildZipWithPaths([{ name: "/tmp/abs.txt", contents: "x\n" }]),
    );
    const outputDir = join(tmp.cwd, "out");

    await expectRejectsMatching(
      () => getExtractPackArchive()({ archivePath, outputDir }),
      /unsafe|absolute|refusing/i,
    );
  });

  test("partial write then bad entry cleans destination (G3)", async () => {
    tmp = createTempDir();
    const archivePath = writeBytes(
      join(tmp.cwd, "partial-escape.zip"),
      buildPartialThenEscapeZip(),
    );
    const outputDir = join(tmp.cwd, "out");

    await expectRejectsMatching(
      () => getExtractPackArchive()({ archivePath, outputDir }),
      /unsafe|path.?escape|refusing|\.\./i,
    );

    // Fail-closed: no dangling half-write under dest
    expect(listRelativeFiles(outputDir)).toEqual([]);
  });

  test("partial write then symlink cleans destination (G1+G3)", async () => {
    tmp = createTempDir();
    const archivePath = writeBytes(
      join(tmp.cwd, "partial-link.zip"),
      buildPartialThenSymlinkZip(),
    );
    const outputDir = join(tmp.cwd, "out");

    await expectRejectsMatching(
      () => getExtractPackArchive()({ archivePath, outputDir }),
      /symlink|symbolic|unsafe|link|refusing/i,
    );

    expect(listRelativeFiles(outputDir)).toEqual([]);
  });

  test(`entry count over ${MAX_SAFE_ENTRIES} fails closed (G4)`, async () => {
    tmp = createTempDir();
    const archivePath = writeBytes(join(tmp.cwd, "entries.zip"), buildOverEntryCapZip());
    const outputDir = join(tmp.cwd, "out");

    await expectRejectsMatching(
      () => getExtractPackArchive()({ archivePath, outputDir }),
      /entr(y|ies)|cap|limit|10000|10[\s_]?000|too many/i,
    );

    expect(listRelativeFiles(outputDir)).toEqual([]);
  });

  test(`uncompressed size over ${MAX_SAFE_UNCOMPRESSED_BYTES} fails closed (G5)`, async () => {
    tmp = createTempDir();
    const archivePath = writeBytes(join(tmp.cwd, "huge.zip"), buildOverSizeCapZip());
    const outputDir = join(tmp.cwd, "out");

    await expectRejectsMatching(
      () => getExtractPackArchive()({ archivePath, outputDir }),
      /size|cap|limit|100\s*MB|104857600|too large|uncompressed/i,
    );

    expect(listRelativeFiles(outputDir)).toEqual([]);
  });

  test("regular safe zip still extracts under caps", async () => {
    tmp = createTempDir();
    const archivePath = writeBytes(join(tmp.cwd, "safe.zip"), buildSafeRegularZip());
    const outputDir = join(tmp.cwd, "out");

    await getExtractPackArchive()({ archivePath, outputDir });
    const files = listRelativeFiles(outputDir);
    expect(files).toContain("apm.yml");
    expect(files).toContain(".apm/keep.txt");
  });
});
