/**
 * install-pipeline S1 — dual-write deployed_files with hashes.
 */
import { describe, expect, test } from "vite-plus/test";
import type { LockfileDocument } from "@b-apm/core";
import { getApplyDeployedHashesToLock } from "./helpers.ts";

describe("mp-find install dual-write S1", () => {
  test("hash write also updates deployed_files list field", () => {
    const apply = getApplyDeployedHashesToLock();
    const document: LockfileDocument = {
      lockfile_version: "1",
      dependencies: [
        {
          name: "skill-dep",
          repo_url: "local:skill-dep",
          source: "local",
          path: "./skill-dep",
        },
      ],
    };

    const wrote = apply({
      document,
      deployed: [{ path: ".agents/skills/hello/SKILL.md", hash: "abc123deadbeef" }],
      primitives: [
        {
          name: "hello",
          kind: "skill",
          packageName: "skill-dep",
          package: "skill-dep",
          contributingPackage: "skill-dep",
        },
      ],
    });

    expect(wrote).toBe(true);
    const dep = document.dependencies[0]!;
    expect(dep.deployed_file_hashes).toBeTruthy();
    expect(dep.deployed_file_hashes?.[".agents/skills/hello/SKILL.md"]).toBe("abc123deadbeef");
    expect(Array.isArray(dep.deployed_files), "deployed_files must be dual-written").toBe(true);
    expect(dep.deployed_files).toContain(".agents/skills/hello/SKILL.md");
  });

  test("local hashes dual-write local_deployed_files list", () => {
    const apply = getApplyDeployedHashesToLock();
    const document: LockfileDocument = {
      lockfile_version: "1",
      dependencies: [
        {
          name: "a",
          repo_url: "local:a",
          source: "local",
        },
        {
          name: "b",
          repo_url: "local:b",
          source: "local",
        },
      ],
    };

    // Unattributed path with multiple deps → local_* fallback in applyDeployedHashesToLock
    const wrote = apply({
      document,
      deployed: [{ path: "notes/local.md", hash: "localhash99" }],
      primitives: [],
    });

    expect(wrote).toBe(true);
    expect(document.local_deployed_file_hashes?.["notes/local.md"]).toBe("localhash99");
    expect(
      Array.isArray(document.local_deployed_files),
      "local_deployed_files must be dual-written",
    ).toBe(true);
    expect(document.local_deployed_files).toContain("notes/local.md");
  });

  test("dual-write keeps hash maps as the inventory source of truth", () => {
    const apply = getApplyDeployedHashesToLock();
    const document: LockfileDocument = {
      lockfile_version: "1",
      dependencies: [
        {
          name: "only",
          repo_url: "local:only",
          source: "local",
          deployed_file_hashes: { "old.md": "oldhash" },
          deployed_files: ["old.md"],
        },
      ],
    };

    apply({
      document,
      deployed: [{ path: "new.md", hash: "newhash" }],
      primitives: [],
    });

    const dep = document.dependencies[0]!;
    // Hash map still present and keyed (orphan cleanup continues to key off hashes)
    expect(dep.deployed_file_hashes?.["old.md"]).toBe("oldhash");
    expect(dep.deployed_file_hashes?.["new.md"]).toBe("newhash");
    expect(dep.deployed_files).toContain("new.md");
  });
});
