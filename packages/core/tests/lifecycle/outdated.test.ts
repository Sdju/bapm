/**
 * Core outdated — checklist C §6–8 (P6e tip / constraint semantics).
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import {
  createFakePorts,
  createTempProject,
  exitCodeOf,
  expectRejectsMatching,
  fakeCommit,
  getRunOutdated,
  rowsOf,
  statusOf,
  textOf,
  writeLock,
  writeManifest,
  type TempProject,
} from "./helpers.ts";

describe("core outdated", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("§6 up-to-date lock reports success / up-to-date rows", async () => {
    project = createTempProject();
    const commit = fakeCommit("tip-ok");
    const ports = createFakePorts({
      tagsByRepo: {
        "example/ok": [{ tag: "v1.0.0", commit }],
      },
      commitsByRef: {
        main: commit,
        "v1.0.0": commit,
        HEAD: commit,
      },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: outdated-ok\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/ok.git\n      ref: "^1.0.0"\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/ok\n    name: ok\n    constraint: "^1.0.0"\n    resolved_commit: "${commit}"\n    resolved_tag: v1.0.0\n    resolved_ref: v1.0.0\n`,
    );

    const result = await getRunOutdated()({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
    });
    expect(exitCodeOf(result)).toBe(0);
    const blob = `${textOf(result)}\n${JSON.stringify(result)}`;
    expect(blob).toMatch(/up-to-date|up to date|all.*(current|ok)/i);
  });

  test("§7 outdated row when tip ahead; still exit 0", async () => {
    project = createTempProject();
    const locked = fakeCommit("locked-sha");
    const tip = fakeCommit("tip-ahead");
    const ports = createFakePorts({
      tagsByRepo: {
        "example/drift": [
          { tag: "v1.0.0", commit: locked },
          { tag: "v1.2.0", commit: tip },
        ],
      },
      commitsByRef: {
        main: tip,
      },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: outdated-drift\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/drift.git\n      ref: "^1.0.0"\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/drift\n    name: drift\n    constraint: "^1.0.0"\n    resolved_commit: "${locked}"\n    resolved_tag: v1.0.0\n    resolved_ref: v1.0.0\n`,
    );

    const result = await getRunOutdated()({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
    });
    expect(exitCodeOf(result)).toBe(0);
    const rows = rowsOf(result);
    const outdated = rows.filter((r) => /outdated/i.test(statusOf(r)));
    expect(outdated.length).toBeGreaterThan(0);
    const blob = JSON.stringify(outdated);
    expect(blob).toMatch(/v1\.0\.0|locked|current/i);
    expect(blob).toMatch(/v1\.2\.0|latest|tip/i);
  });

  test("§8 no lockfile → non-success", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: outdated-nolock\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );
    const ports = createFakePorts();

    await expectRejectsMatching(async () => {
      const result = await getRunOutdated()({
        cwd: project.cwd,
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
      });
      if (exitCodeOf(result) === 0) {
        throw new Error("outdated succeeded without lock");
      }
      throw new Error(`outdated failed: lock missing (exit ${exitCodeOf(result)})`);
    }, /lock/i);
  });

  test("P6e: branch tip ≠ HEAD; no invented ^ from tag", async () => {
    project = createTempProject();
    const locked = fakeCommit("unit-branch-locked");
    const headTip = locked;
    const featureTip = fakeCommit("unit-feature-ahead");
    const ports = createFakePorts({
      tagsByRepo: {
        "example/unit-branch": [
          { tag: "v1.2.3", commit: locked },
          { tag: "v1.9.0", commit: fakeCommit("unit-newer-tag") },
        ],
      },
      commitsByRef: {
        HEAD: headTip,
        "feature/x": featureTip,
        "v1.2.3": locked,
      },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: outdated-unit-branch\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/unit-branch.git\n      ref: feature/x\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/unit-branch\n    name: unit-branch\n    resolved_commit: "${locked}"\n    resolved_tag: v1.2.3\n    resolved_ref: feature/x\n`,
    );

    const result = await getRunOutdated()({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
    });
    expect(exitCodeOf(result)).toBe(0);
    const rows = rowsOf(result);
    expect(statusOf(rows[0]!)).toMatch(/outdated/);
    expect(ports.lsRemoteCalls.some((c) => c.includes("feature/x"))).toBe(true);
    expect(ports.tagListCalls).toEqual([]);
  });

  test("P6e: local skip without network", async () => {
    project = createTempProject();
    const ports = createFakePorts();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: outdated-unit-local\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n`,
    );

    const result = await getRunOutdated()({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      verbose: true,
    });
    expect(exitCodeOf(result)).toBe(0);
    expect(ports.lsRemoteCalls).toEqual([]);
    expect(ports.tagListCalls).toEqual([]);
    expect(textOf(result)).toMatch(/local|skip/i);
  });
});
