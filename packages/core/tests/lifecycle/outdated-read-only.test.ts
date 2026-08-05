/**
 * Outdated — exit policy + read-only project tree.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createFakePorts,
  createTempProject,
  exitCodeOf,
  expectRejectsMatching,
  fakeCommit,
  getRunOutdated,
  projectFingerprint,
  rowsOf,
  statusOf,
  writeLock,
  writeManifest,
  type TempProject,
} from "./helpers.ts";

describe("core outdated — exit + read-only", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("missing lock → non-success", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: p6e-nolock\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
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

  test("outdated rows still exit 0", async () => {
    project = createTempProject();
    const locked = fakeCommit("exit0-locked");
    const tip = fakeCommit("exit0-tip");
    const ports = createFakePorts({
      commitsByRef: {
        HEAD: tip,
        main: tip,
      },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: p6e-exit0\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/exit0.git\n      ref: main\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/exit0\n    name: exit0\n    resolved_commit: "${locked}"\n    resolved_ref: main\n`,
    );

    const result = await getRunOutdated()({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
    });
    expect(exitCodeOf(result)).toBe(0);
    expect(rowsOf(result).some((r) => /outdated/i.test(statusOf(r)))).toBe(true);
  });

  test("project tree bit-identical after outdated (default and verbose)", async () => {
    project = createTempProject();
    const tip = fakeCommit("ro-tip");
    const ports = createFakePorts({
      commitsByRef: { HEAD: tip, main: tip },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: p6e-readonly\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/ro.git\n      ref: main\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/ro\n    name: ro\n    resolved_commit: "${tip}"\n    resolved_ref: main\n`,
    );
    mkdirSync(join(project.cwd, "apm_modules"), { recursive: true });
    writeFileSync(join(project.cwd, "apm_modules", ".keep"), "keep\n", "utf8");
    mkdirSync(join(project.cwd, ".agents"), { recursive: true });
    writeFileSync(join(project.cwd, ".agents", "marker"), "m\n", "utf8");

    const before = projectFingerprint(project.cwd);
    await getRunOutdated()({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
    });
    expect(projectFingerprint(project.cwd)).toBe(before);

    await getRunOutdated()({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      verbose: true,
    });
    expect(projectFingerprint(project.cwd)).toBe(before);
  });
});
