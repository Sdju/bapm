/**
 * sc-002 / G1–G6 / lk-013 — Registry materializeRegistryArchive safe-extract (RED until apply).
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
  expectThrowsMatching,
  getExtractPackArchive,
  getMaterializeRegistryArchive,
  listRelativeFiles,
  sha256Digest,
  writeBytes,
  type TempDir,
} from "./helpers.ts";

describe("sc-soft-security Registry safe-extract", () => {
  let tmp: TempDir | undefined;

  afterEach(() => {
    tmp?.cleanup();
    tmp = undefined;
  });

  test("symlink zip fails after matching digest; no package tree (G1+lk-013 order)", () => {
    tmp = createTempDir();
    const bytes = buildSymlinkZip({
      companionFile: { name: "apm.yml", contents: 'name: x/y\nversion: "1.0.0"\n' },
    });
    const dest = join(tmp.cwd, "apm_modules", "x", "y", "1.0.0");

    expectThrowsMatching(
      () =>
        getMaterializeRegistryArchive()({
          cwd: tmp!.cwd,
          dest,
          bytes,
          expectedDigest: sha256Digest(bytes),
          label: "x/y@1.0.0",
        }),
      /symlink|symbolic|unsafe|link|refusing/i,
    );

    expect(listRelativeFiles(dest)).toEqual([]);
  });

  test("dot-dot path escape rejected on registry path", () => {
    tmp = createTempDir();
    const bytes = buildZipWithPaths([{ name: "../../etc/passwd", contents: "x\n" }]);
    const dest = join(tmp.cwd, "dest");

    expectThrowsMatching(
      () =>
        getMaterializeRegistryArchive()({
          cwd: tmp!.cwd,
          dest,
          bytes,
          expectedDigest: sha256Digest(bytes),
        }),
      /unsafe|path.?escape|refusing|\.\./i,
    );
  });

  test("partial then escape cleans registry dest (G3)", () => {
    tmp = createTempDir();
    const bytes = buildPartialThenEscapeZip();
    const dest = join(tmp.cwd, "dest");

    expectThrowsMatching(
      () =>
        getMaterializeRegistryArchive()({
          cwd: tmp!.cwd,
          dest,
          bytes,
          expectedDigest: sha256Digest(bytes),
        }),
      /unsafe|path.?escape|refusing|\.\./i,
    );

    expect(listRelativeFiles(dest)).toEqual([]);
  });

  test("partial then symlink cleans registry dest (G1+G3)", () => {
    tmp = createTempDir();
    const bytes = buildPartialThenSymlinkZip();
    const dest = join(tmp.cwd, "dest");

    expectThrowsMatching(
      () =>
        getMaterializeRegistryArchive()({
          cwd: tmp!.cwd,
          dest,
          bytes,
          expectedDigest: sha256Digest(bytes),
        }),
      /symlink|symbolic|unsafe|link|refusing/i,
    );

    expect(listRelativeFiles(dest)).toEqual([]);
  });

  test(`registry entry count over ${MAX_SAFE_ENTRIES} fails (G4)`, () => {
    tmp = createTempDir();
    const bytes = buildOverEntryCapZip();
    const dest = join(tmp.cwd, "dest");

    expectThrowsMatching(
      () =>
        getMaterializeRegistryArchive()({
          cwd: tmp!.cwd,
          dest,
          bytes,
          expectedDigest: sha256Digest(bytes),
        }),
      /entr(y|ies)|cap|limit|10000|10[\s_]?000|too many/i,
    );

    expect(listRelativeFiles(dest)).toEqual([]);
  });

  test(`registry uncompressed over ${MAX_SAFE_UNCOMPRESSED_BYTES} fails (G5)`, () => {
    tmp = createTempDir();
    const bytes = buildOverSizeCapZip();
    const dest = join(tmp.cwd, "dest");

    expectThrowsMatching(
      () =>
        getMaterializeRegistryArchive()({
          cwd: tmp!.cwd,
          dest,
          bytes,
          expectedDigest: sha256Digest(bytes),
        }),
      /size|cap|limit|100\s*MB|104857600|too large|uncompressed/i,
    );

    expect(listRelativeFiles(dest)).toEqual([]);
  });

  test("digest mismatch fails before extract; dest untouched (lk-013)", () => {
    tmp = createTempDir();
    const bytes = buildSafeRegularZip();
    const dest = join(tmp.cwd, "dest");
    const wrong = `sha256:${"ab".repeat(32)}`;

    expectThrowsMatching(
      () =>
        getMaterializeRegistryArchive()({
          cwd: tmp!.cwd,
          dest,
          bytes,
          expectedDigest: wrong,
          label: "contoso/demo@1.0.0",
        }),
      /digest|hash|lk-013|mismatch|integrity|sha256/i,
    );

    expect(listRelativeFiles(dest)).toEqual([]);
  });

  test("same symlink zip rejected on Pack and Registry twin paths (G6)", async () => {
    tmp = createTempDir();
    const bytes = buildSymlinkZip();
    const packOut = join(tmp.cwd, "pack-out");
    const regOut = join(tmp.cwd, "reg-out");
    const archivePath = writeBytes(join(tmp.cwd, "twin-symlink.zip"), bytes);

    await expectRejectsMatching(
      () => getExtractPackArchive()({ archivePath, outputDir: packOut }),
      /symlink|symbolic|unsafe|link|refusing/i,
    );
    expectThrowsMatching(
      () =>
        getMaterializeRegistryArchive()({
          cwd: tmp!.cwd,
          dest: regOut,
          bytes,
          expectedDigest: sha256Digest(bytes),
        }),
      /symlink|symbolic|unsafe|link|refusing/i,
    );

    expect(listRelativeFiles(packOut)).toEqual([]);
    expect(listRelativeFiles(regOut)).toEqual([]);
  });
});
