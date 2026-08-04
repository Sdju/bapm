/**
 * Unit tests for OpenAPM §5.6.4 canonical tree_sha256 (lk-015).
 */
import { chmodSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  collectTreeSha256Violations,
  computeCanonicalTreeSha256,
} from "../../src/modules/Lockfile/treeSha256.ts";
import { createTempProject, writeText, type TempProject } from "../lifecycle/helpers.ts";

describe("Lockfile computeCanonicalTreeSha256", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("deterministic + modes + .git exclusion", () => {
    project = createTempProject();
    const root = join(project.cwd, "pkg");
    writeText(join(root, "plain.txt"), "x\n");
    writeText(join(root, "run.sh"), "#!/bin/sh\necho hi\n");
    chmodSync(join(root, "run.sh"), 0o755);
    symlinkSync("plain.txt", join(root, "link.txt"));
    writeText(join(root, "sub", "leaf.txt"), "leaf\n");
    mkdirSync(join(root, ".git", "objects"), { recursive: true });
    writeFileSync(join(root, ".git", "HEAD"), "ref: refs/heads/main\n");

    const a = computeCanonicalTreeSha256(root);
    const b = computeCanonicalTreeSha256(root);
    expect(a).toBe(b);
    expect(a).toMatch(/^sha256:[0-9a-f]{64}$/);

    const withoutGit = join(project.cwd, "nogit");
    writeText(join(withoutGit, "plain.txt"), "x\n");
    writeText(join(withoutGit, "run.sh"), "#!/bin/sh\necho hi\n");
    chmodSync(join(withoutGit, "run.sh"), 0o755);
    symlinkSync("plain.txt", join(withoutGit, "link.txt"));
    writeText(join(withoutGit, "sub", "leaf.txt"), "leaf\n");
    expect(computeCanonicalTreeSha256(withoutGit)).toBe(a);

    chmodSync(join(root, "run.sh"), 0o644);
    expect(computeCanonicalTreeSha256(root)).not.toBe(a);
  });

  test("collectTreeSha256Violations missing field and mismatch", () => {
    project = createTempProject();
    const commit = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const tree = join(project.cwd, "apm_modules", "github.com_example_pkg", commit.slice(0, 12));
    writeText(join(tree, "apm.yml"), "name: pkg\nversion: 0.0.1\n");
    const good = computeCanonicalTreeSha256(tree);

    const missing = collectTreeSha256Violations({
      cwd: project.cwd,
      document: {
        lockfile_version: "1",
        dependencies: [
          {
            repo_url: "github.com/example/pkg",
            name: "pkg",
            resolved_commit: commit,
          },
        ],
      },
    });
    expect(missing).toHaveLength(1);
    expect(missing[0]!.kind).toBe("missing_field");

    const mismatch = collectTreeSha256Violations({
      cwd: project.cwd,
      document: {
        lockfile_version: "1",
        dependencies: [
          {
            repo_url: "github.com/example/pkg",
            name: "pkg",
            resolved_commit: commit,
            tree_sha256: `sha256:${"0".repeat(64)}`,
          },
        ],
      },
    });
    expect(mismatch).toHaveLength(1);
    expect(mismatch[0]!.kind).toBe("mismatch");
    expect(mismatch[0]!.message).toMatch(/expected|observed/i);

    const ok = collectTreeSha256Violations({
      cwd: project.cwd,
      document: {
        lockfile_version: "1",
        dependencies: [
          {
            repo_url: "github.com/example/pkg",
            name: "pkg",
            resolved_commit: commit,
            tree_sha256: good,
          },
          {
            repo_url: "local:leaf",
            name: "leaf",
            source: "local",
            path: "leaf",
          },
        ],
      },
    });
    expect(ok).toHaveLength(0);
  });
});
