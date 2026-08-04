/**
 * lk-015: audit --ci re-verifies tree_sha256 (hard fail; closes M6 soft).
 */
import { downloadPackages } from "@bapm/core";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createFakePorts,
  createTempProject,
  diagnosticsText,
  exitCodeOf,
  findPackageTreeRoot,
  getRunAuditCi,
  referenceCanonicalTreeSha256,
  writeLock,
  writeManifest,
  writeText,
  type TempProject,
} from "../lockfile/tree-sha256-helpers.ts";

const COMMIT = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const BAD_TREE = `sha256:${"0".repeat(64)}`;

describe("lk-015 audit --ci tree_sha256 verify", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("missing tree_sha256 on git entry fails CI and names the entry", async () => {
    project = createTempProject();
    const ports = createFakePorts({ commitsByRef: { main: COMMIT } });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: audit-no-tree\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/git-pkg.git\n      ref: main\n`,
    );
    await downloadPackages({
      cwd: project.cwd,
      packages: [{ repoUrl: "https://github.com/example/git-pkg.git", commit: COMMIT }],
      downloader: ports.downloader,
    });
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/git-pkg\n    name: git-pkg\n    resolved_commit: "${COMMIT}"\n`,
    );

    const result = await getRunAuditCi()({ cwd: project.cwd, ci: true });
    expect(exitCodeOf(result)).not.toBe(0);
    expect(diagnosticsText(result)).toMatch(/git-pkg|github\.com\/example\/git-pkg|tree_sha256/i);
  });

  test("mismatched tree_sha256 fails CI with expected and observed envelopes", async () => {
    project = createTempProject();
    const ports = createFakePorts({ commitsByRef: { main: COMMIT } });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: audit-mismatch\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/git-pkg.git\n      ref: main\n`,
    );
    await downloadPackages({
      cwd: project.cwd,
      packages: [{ repoUrl: "https://github.com/example/git-pkg.git", commit: COMMIT }],
      downloader: ports.downloader,
    });
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/git-pkg\n    name: git-pkg\n    resolved_commit: "${COMMIT}"\n    tree_sha256: "${BAD_TREE}"\n`,
    );

    const result = await getRunAuditCi()({ cwd: project.cwd, ci: true });
    expect(exitCodeOf(result)).toBe(1);
    const diag = diagnosticsText(result);
    expect(diag).toMatch(/git-pkg|github\.com\/example\/git-pkg/i);
    expect(diag).toMatch(/expected|want|recorded/i);
    expect(diag).toMatch(/observed|actual|got|found/i);
    expect(diag).toMatch(/sha256:/);
  });

  test("matching tree_sha256 with clean deployed hashes exits 0", async () => {
    project = createTempProject();
    const ports = createFakePorts({ commitsByRef: { main: COMMIT } });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: audit-match\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/git-pkg.git\n      ref: main\n`,
    );
    await downloadPackages({
      cwd: project.cwd,
      packages: [{ repoUrl: "https://github.com/example/git-pkg.git", commit: COMMIT }],
      downloader: ports.downloader,
    });
    const treeRoot = findPackageTreeRoot(project.cwd, "git-pkg");
    const treeHash = referenceCanonicalTreeSha256(treeRoot);
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/git-pkg\n    name: git-pkg\n    resolved_commit: "${COMMIT}"\n    tree_sha256: "${treeHash}"\n`,
    );

    const result = await getRunAuditCi()({ cwd: project.cwd, ci: true });
    expect(exitCodeOf(result)).toBe(0);
  });

  test("local-path entry without tree_sha256 does not fail solely for absence", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: audit-local\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );
    writeText(joinLeafSkill(project.cwd), "ok\n");
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n`,
    );

    const result = await getRunAuditCi()({ cwd: project.cwd, ci: true });
    expect(exitCodeOf(result)).toBe(0);
  });
});

function joinLeafSkill(cwd: string): string {
  return `${cwd}/.agents/skills/hello/SKILL.md`;
}
