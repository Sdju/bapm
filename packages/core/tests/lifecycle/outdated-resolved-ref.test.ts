/**
 * Outdated / lock parity — resolveAndLock emits resolved_ref; load→serialize round-trips it.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import {
  loadLockfile,
  resolveAndLock,
  serializeLockfile,
} from "@bapm/core";
import {
  createFakePorts,
  createTempProject,
  depsOf,
  fakeCommit,
  lockOf,
  writeLock,
  writeManifest,
  type TempProject,
} from "./helpers.ts";

describe("core outdated — resolved_ref emit + round-trip", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("git-literal branch writes resolved_ref", async () => {
    project = createTempProject();
    const commit = fakeCommit("emit-feature");
    const ports = createFakePorts({
      commitsByRef: {
        "feature/foo": commit,
        HEAD: fakeCommit("emit-head"),
      },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: p6e-emit-branch\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/emit-branch.git\n      ref: feature/foo\n`,
    );

    await resolveAndLock({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    const deps = depsOf(lockOf(loadLockfile({ cwd: project.cwd })));
    const dep = deps.find((d) => String(d.repo_url ?? "").includes("emit-branch"));
    expect(dep).toBeTruthy();
    expect(String(dep!.resolved_ref ?? "")).toBe("feature/foo");
    expect(String(dep!.resolved_commit)).toMatch(/^[0-9a-f]{40}$/i);
  });

  test("git-semver writes resolved_ref equal to resolved_tag", async () => {
    project = createTempProject();
    const commit = fakeCommit("emit-semver");
    const ports = createFakePorts({
      tagsByRepo: {
        "example/emit-semver": [{ tag: "v1.2.0", commit }],
      },
      commitsByRef: {
        "v1.2.0": commit,
        HEAD: commit,
      },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: p6e-emit-semver\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/emit-semver.git\n      ref: "^1.0.0"\n`,
    );

    await resolveAndLock({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    const deps = depsOf(lockOf(loadLockfile({ cwd: project.cwd })));
    const dep = deps.find((d) => String(d.repo_url ?? "").includes("emit-semver"));
    expect(dep).toBeTruthy();
    expect(String(dep!.resolved_tag)).toBe("v1.2.0");
    expect(String(dep!.resolved_ref)).toBe("v1.2.0");
    expect(String(dep!.constraint)).toMatch(/\^1/);
  });

  test("HEAD literal still records resolved_ref", async () => {
    project = createTempProject();
    const commit = fakeCommit("emit-head-lit");
    const ports = createFakePorts({
      commitsByRef: { HEAD: commit },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: p6e-emit-head\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/emit-head.git\n`,
    );

    await resolveAndLock({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    const deps = depsOf(lockOf(loadLockfile({ cwd: project.cwd })));
    const dep = deps.find((d) => String(d.repo_url ?? "").includes("emit-head"));
    expect(dep).toBeTruthy();
    expect(String(dep!.resolved_ref ?? "")).toMatch(/^HEAD$/i);
    expect(String(dep!.resolved_commit)).toMatch(/^[0-9a-f]{40}$/i);
  });

  test("resolved_ref round-trips on load → serialize", () => {
    project = createTempProject();
    const commit = fakeCommit("roundtrip-ref");
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/roundtrip\n    name: roundtrip\n    resolved_commit: "${commit}"\n    resolved_ref: release\n`,
    );

    const doc = lockOf(loadLockfile({ cwd: project.cwd }));
    const yaml = serializeLockfile(doc);
    expect(yaml).toMatch(/resolved_ref:\s*release/);
    expect(yaml).toMatch(new RegExp(`resolved_commit:\\s*["']?${commit}`));
  });
});
