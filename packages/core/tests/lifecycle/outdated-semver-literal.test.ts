/**
 * Outdated — no invented ^ from resolved_tag; explicit constraint still works.
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

describe("core outdated — semver constraint vs tag-only literal", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("tag without constraint is not a fake caret range", async () => {
    project = createTempProject();
    const locked = fakeCommit("tag-v123");
    const newer = fakeCommit("tag-v190");
    const ports = createFakePorts({
      tagsByRepo: {
        "example/tagged": [
          { tag: "v1.2.3", commit: locked },
          { tag: "v1.9.0", commit: newer },
        ],
      },
      commitsByRef: {
        HEAD: locked,
        "v1.2.3": locked,
      },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: p6e-tag-literal\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/tagged.git\n      ref: v1.2.3\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "2"\ndependencies:\n  - repo_url: github.com/example/tagged\n    name: tagged\n    resolved_commit: "${locked}"\n    resolved_tag: v1.2.3\n    resolved_ref: v1.2.3\n`,
    );

    const result = await getRunOutdated()({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
    });
    expect(exitCodeOf(result)).toBe(0);
    const rows = rowsOf(result);
    const row = rows.find((r) => /tagged/i.test(String(r.name ?? "")));
    expect(row).toBeTruthy();
    // Must NOT invent ^1.0.0 and flag outdated solely for v1.9.0.
    expect(statusOf(row!)).not.toMatch(/outdated/);
    expect(ports.tagListCalls).toEqual([]);
  });

  test("explicit constraint still detects newer satisfying tag", async () => {
    project = createTempProject();
    const locked = fakeCommit("semver-v100");
    const tip = fakeCommit("semver-v120");
    const ports = createFakePorts({
      tagsByRepo: {
        "example/semver": [
          { tag: "v1.0.0", commit: locked },
          { tag: "v1.2.0", commit: tip },
        ],
      },
      commitsByRef: {
        HEAD: tip,
      },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: p6e-semver\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/semver.git\n      ref: "^1.0.0"\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "2"\ndependencies:\n  - repo_url: github.com/example/semver\n    name: semver\n    constraint: "^1.0.0"\n    resolved_commit: "${locked}"\n    resolved_tag: v1.0.0\n    resolved_ref: v1.0.0\n`,
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
    expect(blob).toMatch(/v1\.0\.0/);
    expect(blob).toMatch(/v1\.2\.0/);
  });
});
