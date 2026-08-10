/**
 * Unit: Find reverse index, lookup normalize/prefix, labels, origin, dual-write.
 */
import { describe, expect, test } from "vite-plus/test";
import {
  applyDeployedHashesToLock,
  buildReverseIndex,
  formatFindOrigin,
  formatFindOwnerLabel,
  lookupInIndex,
  normalizeFindPath,
  type LockfileDocument,
} from "@b-apm/core";

const sample: LockfileDocument = {
  lockfile_version: "1",
  dependencies: [
    {
      name: "org/alpha",
      repo_url: "https://example.com/org/alpha.git",
      source: "git",
      resolved_ref: "main",
      resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      deployed_file_hashes: {
        "AGENTS.md": "aaa",
        "skills/": "d1",
        "skills/foo/": "d2",
        "skills/foo/SKILL.md": "s1",
      },
      deployed_files: ["AGENTS.md"],
    },
    {
      name: "org/beta",
      repo_url: "https://example.com/org/beta.git",
      source: "git",
      resolved_tag: "v1.0.0",
      deployed_file_hashes: { "AGENTS.md": "bbb" },
      deployed_files: ["shared/x.md"],
    },
  ],
  local_deployed_file_hashes: { "notes/local.md": "loc" },
};

describe("Find unit", () => {
  test("normalize strips slash, ./ and backslashes", () => {
    expect(normalizeFindPath("/./skills\\foo\\SKILL.md")).toBe("skills/foo/SKILL.md");
  });

  test("buildReverseIndex covers hashes, lists, local, multi-owner order", () => {
    const index = buildReverseIndex(sample);
    expect(index.get("AGENTS.md")).toEqual(["org/alpha", "org/beta"]);
    expect(index.get("shared/x.md")).toEqual(["org/beta"]);
    expect(index.get("notes/local.md")).toEqual(["."]);
  });

  test("lookup exact and longest directory prefix", () => {
    const index = buildReverseIndex(sample);
    expect(lookupInIndex("skills/foo/SKILL.md", index)).toEqual(["org/alpha"]);
    expect(lookupInIndex("skills/foo/bar.md", index)).toEqual(["org/alpha"]);
    expect(lookupInIndex("not-tracked.txt", index)).toEqual([]);
  });

  test("owner label prefers repo_url; workspace is dot", () => {
    expect(formatFindOwnerLabel("org/alpha", sample.dependencies[0]!)).toBe(
      "https://example.com/org/alpha.git",
    );
    expect(formatFindOwnerLabel(".")).toBe(".");
  });

  test("origin prefers resolved_ref over bare repo_url", () => {
    const origin = formatFindOrigin("org/alpha", sample.dependencies[0]!);
    expect(origin).toBe("https://example.com/org/alpha.git@main");
    expect(formatFindOrigin(".")).toBe(".  (workspace)");
  });

  test("applyDeployedHashesToLock dual-writes list fields", () => {
    const document: LockfileDocument = {
      lockfile_version: "1",
      dependencies: [{ name: "only", repo_url: "local:only", source: "local" }],
    };
    applyDeployedHashesToLock({
      document,
      deployed: [{ path: "a.md", hash: "h" }],
      primitives: [],
    });
    expect(document.dependencies[0]!.deployed_files).toContain("a.md");
  });
});
