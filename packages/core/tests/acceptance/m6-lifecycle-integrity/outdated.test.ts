/**
 * M6 core outdated acceptance — checklist C §6–8.
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
  textOf,
  writeLock,
  writeManifest,
  type TempProject,
} from "./helpers.ts";

function statusOf(row: Record<string, unknown>): string {
  return String(row.status ?? row.state ?? row.result ?? "").toLowerCase();
}

describe("M6 core outdated", () => {
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
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/ok\n    name: ok\n    resolved_commit: "${commit}"\n    resolved_tag: v1.0.0\n`,
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
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/drift\n    name: drift\n    resolved_commit: "${locked}"\n    resolved_tag: v1.0.0\n`,
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

    await expectRejectsMatching(
      async () => {
        const result = await getRunOutdated()({
          cwd: project.cwd,
          gitRemote: ports.gitRemote,
          tagLister: ports.tagLister,
        });
        if (exitCodeOf(result) === 0) {
          throw new Error("outdated succeeded without lock");
        }
        throw new Error(`outdated failed: lock missing (exit ${exitCodeOf(result)})`);
      },
      /lock/i,
    );
  });
});
