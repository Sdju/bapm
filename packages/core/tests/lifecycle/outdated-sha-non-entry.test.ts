/**
 * Core outdated — non–full-SHA pins stay on tip / constraint paths (regressions).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createRevisionPinPorts,
  createTempProject,
  exitCodeOf,
  fakeCommit,
  findRowByName,
  getRunOutdated,
  rowsOf,
  statusOf,
  writeLock,
  writeManifest,
  type TempProject,
} from "./helpers.ts";

describe("core outdated — abbreviated / constraint non-entry", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("abbreviated SHA stays on tip path (not annotated revision-pin)", async () => {
    project = createTempProject();
    const locked = fakeCommit("p7g-abbr-locked");
    const tipAhead = fakeCommit("p7g-abbr-tip");
    const annotatedNewer = fakeCommit("p7g-abbr-ann");
    const abbr = locked.slice(0, 12);
    expect(abbr).not.toHaveLength(40);

    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: p7g-abbr
version: 0.0.1
dependencies:
  apm:
    - git: https://github.com/example/abbr.git
      ref: ${abbr}
`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"
dependencies:
  - repo_url: github.com/example/abbr
    name: abbr
    resolved_commit: "${locked}"
    resolved_ref: "${abbr}"
`,
    );

    const ports = createRevisionPinPorts({
      tagsByRepo: {
        "example/abbr": [{ tag: "v9.9.9", commit: annotatedNewer, annotated: true }],
      },
      commitsByRef: {
        [abbr]: tipAhead,
        HEAD: locked,
      },
    });

    const result = await getRunOutdated()({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
    });

    expect(exitCodeOf(result)).toBe(0);
    const row = findRowByName(rowsOf(result), "abbr");
    expect(row).toBeTruthy();
    // Tip-of-abbreviated-ref path: outdated vs tipAhead, not vs annotated v9.9.9.
    expect(statusOf(row!)).toBe("outdated");
    expect(String(row!.latest ?? "")).toMatch(new RegExp(tipAhead, "i"));
    expect(String(row!.latest ?? "")).not.toMatch(/v9\.9\.9/);
    expect(ports.lsRemoteCalls.some((c) => c.includes(`#${abbr}`))).toBe(true);
    // Must not enter revision-pin solely because ref looks hex-like.
    expect(ports.tagListCalls).toEqual([]);
  });

  test("constraint path unchanged when lock also has 40-hex resolved_ref", async () => {
    project = createTempProject();
    const locked = fakeCommit("p7g-semver-v100");
    const newer = fakeCommit("p7g-semver-v120");
    // Full SHA as resolved_ref must NOT replace constraint checks.
    const shaPin = fakeCommit("p7g-semver-sha-pin");

    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: p7g-constraint
version: 0.0.1
dependencies:
  apm:
    - git: https://github.com/example/semver-sha.git
      ref: "^1.0.0"
`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"
dependencies:
  - repo_url: github.com/example/semver-sha
    name: semver-sha
    constraint: "^1.0.0"
    resolved_commit: "${locked}"
    resolved_tag: v1.0.0
    resolved_ref: "${shaPin}"
`,
    );

    const ports = createRevisionPinPorts({
      tagsByRepo: {
        "example/semver-sha": [
          { tag: "v1.0.0", commit: locked, annotated: true },
          { tag: "v1.2.0", commit: newer, annotated: true },
        ],
      },
      commitsByRef: { [shaPin]: shaPin },
    });

    const result = await getRunOutdated()({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
    });

    expect(exitCodeOf(result)).toBe(0);
    const row = findRowByName(rowsOf(result), "semver-sha");
    expect(row).toBeTruthy();
    expect(statusOf(row!)).toBe("outdated");
    expect(String(row!.latest ?? "")).toMatch(/v1\.2\.0/);
    expect(ports.tagListCalls.length).toBeGreaterThan(0);
    // Constraint path — not revision-pin tip_ref / detail.
    expect(String(row!.detail ?? "")).not.toMatch(/revision-pin/i);
  });

  test("branch tip path unchanged beside SHA pins", async () => {
    project = createTempProject();
    const locked = fakeCommit("p7g-branch-locked");
    const featureTip = fakeCommit("p7g-branch-ahead");

    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: p7g-branch
version: 0.0.1
dependencies:
  apm:
    - git: https://github.com/example/branch-pin.git
      ref: feature/x
`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"
dependencies:
  - repo_url: github.com/example/branch-pin
    name: branch-pin
    resolved_commit: "${locked}"
    resolved_ref: feature/x
`,
    );

    const ports = createRevisionPinPorts({
      tagsByRepo: {
        "example/branch-pin": [
          { tag: "v8.0.0", commit: fakeCommit("p7g-branch-tag"), annotated: true },
        ],
      },
      commitsByRef: {
        "feature/x": featureTip,
        HEAD: locked,
      },
    });

    const result = await getRunOutdated()({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
    });

    expect(exitCodeOf(result)).toBe(0);
    const row = findRowByName(rowsOf(result), "branch-pin");
    expect(row).toBeTruthy();
    expect(statusOf(row!)).toBe("outdated");
    expect(String(row!.latest ?? "")).toMatch(new RegExp(featureTip, "i"));
    expect(ports.tagListCalls).toEqual([]);
  });
});
