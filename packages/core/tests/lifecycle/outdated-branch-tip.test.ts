/**
 * Outdated — branch/literal pins use tip of resolved_ref (not unconditional HEAD).
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import {
  createFakePorts,
  createTempProject,
  exitCodeOf,
  fakeCommit,
  getRunOutdated,
  rowsOf,
  statusOf,
  writeLock,
  writeManifest,
  type TempProject,
} from "./helpers.ts";

describe("core outdated — branch / literal tip via resolved_ref", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("non-default branch tip is checked (HEAD match alone is not up-to-date)", async () => {
    project = createTempProject();
    const locked = fakeCommit("branch-locked");
    const headTip = locked;
    const featureTip = fakeCommit("feature-ahead");
    const ports = createFakePorts({
      commitsByRef: {
        HEAD: headTip,
        "feature/foo": featureTip,
      },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: p6e-branch\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/branch.git\n      ref: feature/foo\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/branch\n    name: branch\n    resolved_commit: "${locked}"\n    resolved_ref: feature/foo\n`,
    );

    const result = await getRunOutdated()({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
    });
    expect(exitCodeOf(result)).toBe(0);
    const rows = rowsOf(result);
    const branch = rows.find((r) => String(r.name ?? "").includes("branch") || /branch/i.test(JSON.stringify(r)));
    expect(branch).toBeTruthy();
    expect(statusOf(branch!)).toMatch(/outdated/);
    expect(JSON.stringify(branch)).toMatch(new RegExp(featureTip.slice(0, 12), "i"));
    expect(ports.lsRemoteCalls.some((c) => c.includes("feature/foo"))).toBe(true);
    expect(ports.lsRemoteCalls.every((c) => !c.endsWith("#HEAD"))).toBe(true);
  });

  test("default HEAD pin still reports up-to-date when tip matches", async () => {
    project = createTempProject();
    const tip = fakeCommit("head-tip-ok");
    const ports = createFakePorts({
      commitsByRef: {
        HEAD: tip,
      },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: p6e-head\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/head.git\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/head\n    name: head\n    resolved_commit: "${tip}"\n    resolved_ref: HEAD\n`,
    );

    const result = await getRunOutdated()({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
    });
    expect(exitCodeOf(result)).toBe(0);
    const rows = rowsOf(result);
    expect(rows.every((r) => /up-to-date|up to date/i.test(statusOf(r)))).toBe(true);
  });

  test("manifest fallback when lock omits resolved_ref", async () => {
    project = createTempProject();
    const locked = fakeCommit("release-locked");
    const headTip = locked;
    const releaseTip = fakeCommit("release-ahead");
    const ports = createFakePorts({
      commitsByRef: {
        HEAD: headTip,
        release: releaseTip,
      },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: p6e-manifest-fallback\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/release.git\n      ref: release\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/release\n    name: release-pkg\n    resolved_commit: "${locked}"\n`,
    );

    const result = await getRunOutdated()({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
    });
    expect(exitCodeOf(result)).toBe(0);
    const rows = rowsOf(result);
    const row = rows.find((r) => /release/i.test(String(r.name ?? "")) || /release/i.test(JSON.stringify(r)));
    expect(row).toBeTruthy();
    expect(statusOf(row!)).toMatch(/outdated/);
    expect(ports.lsRemoteCalls.some((c) => /#release$/.test(c) || c.includes("#release"))).toBe(
      true,
    );
  });

  test("local deps skip network ports", async () => {
    project = createTempProject();
    const ports = createFakePorts();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: p6e-local\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
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
    });
    expect(exitCodeOf(result)).toBe(0);
    expect(ports.lsRemoteCalls).toEqual([]);
    expect(ports.tagListCalls).toEqual([]);
  });
});
