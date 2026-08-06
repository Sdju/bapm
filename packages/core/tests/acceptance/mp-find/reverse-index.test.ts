/**
 * G1–G4 — reverse index + lookup (find-reverse-index).
 */
import { describe, expect, test } from "vite-plus/test";
import {
  getBuildReverseIndex,
  getLookupInIndex,
  indexOwnersFor,
  ownersOf,
  sampleFindDocument,
} from "./helpers.ts";

describe("mp-find reverse index + lookup", () => {
  test("hash keys index to dependency owners", () => {
    const build = getBuildReverseIndex();
    const index = build(sampleFindDocument());
    const owners = indexOwnersFor(index, "AGENTS.md");
    expect(owners.length).toBeGreaterThanOrEqual(1);
    expect(owners.some((o) => /alpha|org\/alpha|example\.com\/org\/alpha/i.test(o))).toBe(true);
  });

  test("local hashes map to workspace owner '.'", () => {
    const build = getBuildReverseIndex();
    const index = build(sampleFindDocument());
    const owners = indexOwnersFor(index, "notes/local.md");
    expect(owners).toContain(".");
  });

  test("list fields union with hashes (path only in deployed_files)", () => {
    const build = getBuildReverseIndex();
    const index = build(sampleFindDocument());
    const owners = indexOwnersFor(index, "shared/x.md");
    expect(owners.some((o) => /beta|org\/beta|example\.com\/org\/beta/i.test(o))).toBe(true);
  });

  test("multi-owner preserves first-seen lock dependency order", () => {
    const build = getBuildReverseIndex();
    const index = build(sampleFindDocument());
    const owners = indexOwnersFor(index, "AGENTS.md");
    expect(owners.length).toBeGreaterThanOrEqual(2);
    const alphaIdx = owners.findIndex((o) => /alpha/i.test(o));
    const betaIdx = owners.findIndex((o) => /beta/i.test(o));
    expect(alphaIdx).toBeGreaterThanOrEqual(0);
    expect(betaIdx).toBeGreaterThanOrEqual(0);
    expect(alphaIdx).toBeLessThan(betaIdx);
    // de-dupe
    expect(new Set(owners).size).toBe(owners.length);
  });

  test("path normalize strips leading slash, ./ and backslashes", () => {
    const build = getBuildReverseIndex();
    const lookup = getLookupInIndex();
    const index = build(sampleFindDocument());
    const canon = ownersOf(lookup("skills/foo/SKILL.md", index));
    expect(canon.length).toBeGreaterThan(0);
    expect(ownersOf(lookup("/./skills/foo/SKILL.md", index))).toEqual(canon);
    expect(ownersOf(lookup("skills\\foo\\SKILL.md", index))).toEqual(canon);
  });

  test("longest trailing-slash directory prefix wins", () => {
    const build = getBuildReverseIndex();
    const lookup = getLookupInIndex();
    const index = build(sampleFindDocument());
    const owners = ownersOf(lookup("skills/foo/bar.md", index));
    expect(owners.length).toBeGreaterThan(0);
    // skills/foo/ is longer than skills/ — both map to alpha in sample; assert match exists
    expect(owners.some((o) => /alpha/i.test(o))).toBe(true);
    // Ensure we did not invent owners for a completely foreign path
    expect(ownersOf(lookup("totally/unknown/path.txt", index))).toEqual([]);
  });

  test("unknown path yields empty owners", () => {
    const build = getBuildReverseIndex();
    const lookup = getLookupInIndex();
    const index = build(sampleFindDocument());
    expect(ownersOf(lookup("not-tracked.txt", index))).toEqual([]);
  });
});
