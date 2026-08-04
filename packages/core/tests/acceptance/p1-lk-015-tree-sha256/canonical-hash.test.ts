/**
 * p1-lk-015: canonical tree hash algorithm (OpenAPM §5.6.4) via public API.
 */
import { chmodSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  getComputeCanonicalTreeSha256,
  type TempProject,
  writeText,
} from "./helpers.ts";

describe("p1-lk-015 canonical tree_sha256 algorithm", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("deterministic hash for identical tree", () => {
    project = createTempProject();
    const root = join(project.cwd, "pkg");
    writeText(join(root, "apm.yml"), "name: pkg\nversion: 0.0.1\n");
    writeText(join(root, "README.md"), "# hello\n");

    const hash = getComputeCanonicalTreeSha256();
    const a = hash(root);
    const b = hash(root);
    expect(a).toBe(b);
    expect(a).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test("nested directory contributes recursive 040000 blob hash", () => {
    project = createTempProject();
    const root = join(project.cwd, "pkg");
    writeText(join(root, "apm.yml"), "name: nested\nversion: 0.0.1\n");
    writeText(join(root, "sub", "leaf.txt"), "leaf\n");

    const hash = getComputeCanonicalTreeSha256();
    const withNested = hash(root);

    // Same files flattened (no sub/) must differ
    const flat = join(project.cwd, "flat");
    writeText(join(flat, "apm.yml"), "name: nested\nversion: 0.0.1\n");
    writeText(join(flat, "leaf.txt"), "leaf\n");
    expect(hash(flat)).not.toBe(withNested);
    expect(withNested).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test("dot-git directory excluded from hash", () => {
    project = createTempProject();
    const withGit = join(project.cwd, "with-git");
    const withoutGit = join(project.cwd, "without-git");
    writeText(join(withGit, "apm.yml"), "name: g\nversion: 0.0.1\n");
    writeText(join(withGit, "src", "a.ts"), "export {}\n");
    mkdirSync(join(withGit, ".git", "objects"), { recursive: true });
    writeFileSync(join(withGit, ".git", "HEAD"), "ref: refs/heads/main\n");
    writeFileSync(join(withGit, ".git", "objects", "pack"), "noise\n");

    writeText(join(withoutGit, "apm.yml"), "name: g\nversion: 0.0.1\n");
    writeText(join(withoutGit, "src", "a.ts"), "export {}\n");

    const hash = getComputeCanonicalTreeSha256();
    expect(hash(withGit)).toBe(hash(withoutGit));
  });

  test("symlink and executable modes participate in canonical bytes", () => {
    project = createTempProject();
    const root = join(project.cwd, "modes");
    writeText(join(root, "plain.txt"), "x\n");
    writeText(join(root, "run.sh"), "#!/bin/sh\necho hi\n");
    chmodSync(join(root, "run.sh"), 0o755);
    symlinkSync("plain.txt", join(root, "link.txt"));

    const hash = getComputeCanonicalTreeSha256();
    const observed = hash(root);
    expect(observed).toMatch(/^sha256:[0-9a-f]{64}$/);

    // Flip executable bit → different digest
    chmodSync(join(root, "run.sh"), 0o644);
    expect(hash(root)).not.toBe(observed);
  });
});
