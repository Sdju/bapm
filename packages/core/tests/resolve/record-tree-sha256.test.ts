/**
 * lk-015: record tree_sha256 on git lock write (resolveAndLock).
 */
import { asText } from "../asText.ts";
import { loadLockfile, resolveAndLock } from "@b-apm/core";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createFakePorts,
  createTempProject,
  depsOf,
  findPackageTreeRoot,
  getComputeCanonicalTreeSha256,
  lockOf,
  referenceCanonicalTreeSha256,
  writeManifest,
  writeText,
  type TempProject,
} from "../lockfile/tree-sha256-helpers.ts";

const COMMIT = "ffffffffffffffffffffffffffffffffffffffff";

describe("lk-015 record tree_sha256 on git lock write", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("fresh resolveAndLock records tree_sha256 matching package tree recompute", async () => {
    project = createTempProject();
    const ports = createFakePorts({ commitsByRef: { main: COMMIT } });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: record-root\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/one.git\n      ref: main\n`,
    );

    await resolveAndLock({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    const deps = depsOf(lockOf(loadLockfile({ cwd: project.cwd })));
    expect(deps.length).toBeGreaterThanOrEqual(1);
    const gitDep = deps.find((d) => asText(d.repo_url ?? "").includes("example/one")) ?? deps[0]!;
    const recorded = gitDep.tree_sha256;
    expect(typeof recorded).toBe("string");
    expect(asText(recorded)).toMatch(/^sha256:[0-9a-f]{64}$/);

    const treeRoot = findPackageTreeRoot(project.cwd, "one");
    let expected: string;
    try {
      expected = getComputeCanonicalTreeSha256()(treeRoot);
    } catch {
      expected = referenceCanonicalTreeSha256(treeRoot);
    }
    expect(asText(recorded)).toBe(expected);
  });

  test("local-path lock entry does not require tree_sha256", async () => {
    project = createTempProject();
    const ports = createFakePorts();
    writeText(
      join(project.cwd, "leaf", "apm.yml"),
      `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: local-root\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
    );

    await resolveAndLock({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    const deps = depsOf(lockOf(loadLockfile({ cwd: project.cwd })));
    const local = deps.find(
      (d) => d.source === "local" || asText(d.repo_url ?? "").includes("leaf"),
    );
    expect(local).toBeTruthy();
    expect(local!.tree_sha256 === undefined || local!.tree_sha256 === null).toBe(true);
  });
});
