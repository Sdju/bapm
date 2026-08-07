/**
 * Unit tests for Outdated revision-pin helpers (p7g).
 */
import { describe, expect, test } from "vite-plus/test";
import { parseLsRemoteTagsWithPeel } from "@/modules/Resolver";
import {
  abbreviateSha,
  findLatestAnnotatedTag,
  isFullRevisionPin,
  packageBasenameFromRepo,
} from "@/modules/Outdated";

describe("revisionPin helpers", () => {
  test("isFullRevisionPin — exact 40 hex only", () => {
    expect(isFullRevisionPin("a".repeat(40))).toBe(true);
    expect(isFullRevisionPin("A".repeat(40))).toBe(true);
    expect(isFullRevisionPin(`  ${"b".repeat(40)}  `)).toBe(true);
    expect(isFullRevisionPin("a".repeat(39))).toBe(false);
    expect(isFullRevisionPin("a".repeat(41))).toBe(false);
    expect(isFullRevisionPin("gggggggggggggggggggggggggggggggggggggggg")).toBe(false);
    expect(isFullRevisionPin("feature/x")).toBe(false);
    expect(isFullRevisionPin("")).toBe(false);
    expect(isFullRevisionPin(undefined)).toBe(false);
  });

  test("abbreviateSha — 8 hex lower", () => {
    expect(abbreviateSha("ABCDEF12" + "0".repeat(32))).toBe("abcdef12");
  });

  test("packageBasenameFromRepo — URL and path:", () => {
    expect(packageBasenameFromRepo("github.com/example/sha-drift")).toBe("sha-drift");
    expect(packageBasenameFromRepo("https://github.com/example/pkg.git")).toBe("pkg");
    expect(packageBasenameFromRepo("path:packages/foo")).toBe("foo");
  });

  test("findLatestAnnotatedTag — pattern pick, drop prerelease, exclude lightweight", () => {
    const pin = "1".repeat(40);
    const newer = "2".repeat(40);
    const hit = findLatestAnnotatedTag(
      [
        { tag: "v1.0.0", commit: pin, annotated: true },
        { tag: "v2.0.0-rc.1", commit: "3".repeat(40), annotated: true },
        { tag: "v2.0.0", commit: newer, annotated: true },
        { tag: "v9.0.0", commit: "4".repeat(40), annotated: false },
      ],
      "pkg",
    );
    expect(hit).toEqual({ tag: "v2.0.0", commit: newer });
  });

  test("findLatestAnnotatedTag — empty / no annotated → null", () => {
    expect(findLatestAnnotatedTag([], "pkg")).toBeNull();
    expect(findLatestAnnotatedTag([{ tag: "v1.0.0", commit: "1".repeat(40) }], "pkg")).toBeNull();
    expect(
      findLatestAnnotatedTag(
        [{ tag: "v1.0.0-beta.1", commit: "1".repeat(40), annotated: true }],
        "pkg",
      ),
    ).toBeNull();
  });

  test("findLatestAnnotatedTag — name-prefixed patterns", () => {
    const c = "a".repeat(40);
    expect(
      findLatestAnnotatedTag([{ tag: "my-pkg--v1.2.3", commit: c, annotated: true }], "my-pkg"),
    ).toEqual({ tag: "my-pkg--v1.2.3", commit: c });
    expect(
      findLatestAnnotatedTag([{ tag: "my-pkg-v2.0.0", commit: c, annotated: true }], "my-pkg"),
    ).toEqual({ tag: "my-pkg-v2.0.0", commit: c });
    expect(
      findLatestAnnotatedTag([{ tag: "1.5.0", commit: c, annotated: true }], "my-pkg"),
    ).toEqual({ tag: "1.5.0", commit: c });
  });
});

describe("parseLsRemoteTagsWithPeel", () => {
  test("pairs peel lines as annotated; lightweight without peel", () => {
    const out = [
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\trefs/tags/v1.0.0",
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\trefs/tags/v1.0.0^{}",
      "cccccccccccccccccccccccccccccccccccccccc\trefs/tags/v2.0.0",
    ].join("\n");
    const tags = parseLsRemoteTagsWithPeel(out);
    expect(tags).toEqual(
      expect.arrayContaining([
        { tag: "v1.0.0", commit: "b".repeat(40), annotated: true },
        { tag: "v2.0.0", commit: "c".repeat(40), annotated: false },
      ]),
    );
  });
});
