/**
 * lk-015: frozen install re-verifies tree_sha256 for git entries.
 */
import { downloadPackages } from "@b-apm/core";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createFakePorts,
  createTempProject,
  expectRejectsMatching,
  findPackageTreeRoot,
  getRunInstall,
  readLockBytes,
  referenceCanonicalTreeSha256,
  writeLock,
  writeManifest,
  writeText,
  type TempProject,
} from "../lockfile/tree-sha256-helpers.ts";

const COMMIT = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const BAD_TREE = `sha256:${"f".repeat(64)}`;

describe("lk-015 frozen install tree_sha256 verify", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("tampered / mismatched tree_sha256 fails frozen without rewriting lock", async () => {
    project = createTempProject();
    const ports = createFakePorts({ commitsByRef: { main: COMMIT } });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: frozen-mismatch\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/one.git\n      ref: main\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/one\n    name: one\n    resolved_commit: "${COMMIT}"\n    tree_sha256: "${BAD_TREE}"\n`,
    );
    const before = readLockBytes(project.cwd);

    await expectRejectsMatching(
      () =>
        getRunInstall()({
          cwd: project.cwd,
          frozen: true,
          gitRemote: ports.gitRemote,
          tagLister: ports.tagLister,
          downloader: ports.downloader,
        }),
      /tree_sha256|mismatch|integrity|frozen|hash/i,
    );

    expect(Buffer.compare(readLockBytes(project.cwd), before)).toBe(0);
  });

  test("missing tree_sha256 on git entry fails frozen", async () => {
    project = createTempProject();
    const ports = createFakePorts({ commitsByRef: { main: COMMIT } });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: frozen-missing\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/one.git\n      ref: main\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/one\n    name: one\n    resolved_commit: "${COMMIT}"\n`,
    );
    const before = readLockBytes(project.cwd);

    await expectRejectsMatching(
      () =>
        getRunInstall()({
          cwd: project.cwd,
          frozen: true,
          gitRemote: ports.gitRemote,
          tagLister: ports.tagLister,
          downloader: ports.downloader,
        }),
      /tree_sha256|missing|frozen|integrity/i,
    );

    expect(Buffer.compare(readLockBytes(project.cwd), before)).toBe(0);
  });

  test("matching tree_sha256 allows frozen success and leaves lock bytes unchanged", async () => {
    project = createTempProject();
    const ports = createFakePorts({ commitsByRef: { main: COMMIT } });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: frozen-match\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/one.git\n      ref: main\n`,
    );

    // Pre-materialize so we can plant the matching hash the frozen download will recreate
    await downloadPackages({
      cwd: project.cwd,
      packages: [{ repoUrl: "https://github.com/example/one.git", commit: COMMIT }],
      downloader: ports.downloader,
    });
    const treeRoot = findPackageTreeRoot(project.cwd, "one");
    const treeHash = referenceCanonicalTreeSha256(treeRoot);

    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/one\n    name: one\n    resolved_commit: "${COMMIT}"\n    tree_sha256: "${treeHash}"\n`,
    );
    const before = readLockBytes(project.cwd);

    await getRunInstall()({
      cwd: project.cwd,
      frozen: true,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(Buffer.compare(readLockBytes(project.cwd), before)).toBe(0);
  });

  test("local-path frozen success without tree_sha256 still ok", async () => {
    project = createTempProject();
    const ports = createFakePorts();
    writeText(
      join(project.cwd, "leaf", "apm.yml"),
      `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: frozen-local\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n    resolved_commit: "${COMMIT}"\n`,
    );
    const before = readLockBytes(project.cwd);

    await getRunInstall()({
      cwd: project.cwd,
      frozen: true,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(Buffer.compare(readLockBytes(project.cwd), before)).toBe(0);
  });
});
