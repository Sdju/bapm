/**
 * Basic frozen install (lk-006).
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createFakePorts,
  createTempProject,
  expectRejectsMatching,
  getRunInstall,
  listFilesRecursive,
  modulesDir,
  readLockBytes,
  writeLock,
  writeManifest,
  type TempProject,
} from "./helpers.ts";

const COMMIT = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("basic frozen install (lk-006)", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("frozen missing lock fails before modules/lock/target writes", async () => {
    project = createTempProject();
    const ports = createFakePorts({ commitsByRef: { main: COMMIT } });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: frozen-nolock\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/one.git\n      ref: main\n`,
    );
    mkdirSync(join(project.cwd, ".agents"), { recursive: true });
    writeFileSync(join(project.cwd, ".agents", "keep.txt"), "x\n", "utf8");
    const beforeAgents = listFilesRecursive(join(project.cwd, ".agents"));

    const runInstall = getRunInstall();
    await expectRejectsMatching(
      () =>
        runInstall({
          cwd: project.cwd,
          frozen: true,
          gitRemote: ports.gitRemote,
          tagLister: ports.tagLister,
          downloader: ports.downloader,
        }),
      /frozen|lock/i,
    );

    expect(existsSync(join(project.cwd, "bapm.lock.yaml"))).toBe(false);
    expect(existsSync(join(project.cwd, "apm.lock.yaml"))).toBe(false);
    // modules dir must not appear (or stay empty of package trees)
    if (existsSync(modulesDir(project.cwd))) {
      expect(listFilesRecursive(modulesDir(project.cwd))).toEqual([]);
    }
    expect(listFilesRecursive(join(project.cwd, ".agents"))).toEqual(beforeAgents);
  });

  test("frozen missing direct pin fails closed", async () => {
    project = createTempProject();
    const ports = createFakePorts({ commitsByRef: { main: COMMIT } });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: frozen-missing-pin\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/one.git\n      ref: main\n    - git: https://github.com/example/two.git\n      ref: main\n`,
    );
    // Lock only pins one of two direct deps
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/one\n    resolved_commit: "${COMMIT}"\n`,
    );
    const before = readLockBytes(project.cwd);

    const runInstall = getRunInstall();
    await expectRejectsMatching(
      () =>
        runInstall({
          cwd: project.cwd,
          frozen: true,
          gitRemote: ports.gitRemote,
          tagLister: ports.tagLister,
          downloader: ports.downloader,
        }),
      /frozen|pin|lock|missing/i,
    );

    expect(Buffer.compare(readLockBytes(project.cwd), before)).toBe(0);
  });

  test("frozen success leaves lock bytes unchanged", async () => {
    project = createTempProject();
    const ports = createFakePorts({ commitsByRef: { main: COMMIT } });
    mkdirSync(join(project.cwd, "leaf"), { recursive: true });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: frozen-ok\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
    );
    writeFileSync(
      join(project.cwd, "leaf", "apm.yml"),
      `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    // Seed a valid lock (path deps may use empty/special pin shape; apply may normalize)
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: leaf\n    resolved_commit: "${COMMIT}"\n    path: leaf\n`,
    );
    const before = readLockBytes(project.cwd);

    const runInstall = getRunInstall();
    await runInstall({
      cwd: project.cwd,
      frozen: true,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(Buffer.compare(readLockBytes(project.cwd), before)).toBe(0);
  });

  test("frozen + update/re-resolve rejected without mutation", async () => {
    project = createTempProject();
    const ports = createFakePorts({ commitsByRef: { main: COMMIT } });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: frozen-update\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/one.git\n      ref: main\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/one\n    resolved_commit: "${COMMIT}"\n`,
    );
    const before = readLockBytes(project.cwd);

    const runInstall = getRunInstall();
    await expectRejectsMatching(
      () =>
        runInstall({
          cwd: project.cwd,
          frozen: true,
          update: true,
          updateRefs: true,
          gitRemote: ports.gitRemote,
          tagLister: ports.tagLister,
          downloader: ports.downloader,
        }),
      /frozen|update|reject|mutat/i,
    );

    expect(Buffer.compare(readLockBytes(project.cwd), before)).toBe(0);
  });
});
