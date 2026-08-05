/**
 * Core outdated — full-SHA revision-pin path (p7g) with injectable stubs.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
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

describe("core outdated — SHA revision-pin stubs", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("newer annotated → outdated; match → up-to-date; display SHOULD", async () => {
    project = createTempProject();
    const pin = fakeCommit("unit-pin-old");
    const tagCommit = fakeCommit("unit-tag-v200");
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: unit-sha\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/unit-sha.git\n      ref: ${pin}\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/unit-sha\n    name: unit-sha\n    resolved_commit: "${pin}"\n    resolved_ref: "${pin}"\n`,
    );
    const ports = createFakePorts({
      tagsByRepo: {
        "example/unit-sha": [
          { tag: "v1.0.0", commit: pin, annotated: true },
          { tag: "v2.0.0", commit: tagCommit, annotated: true },
        ],
      },
      commitsByRef: { [pin]: pin },
    });

    const result = await getRunOutdated()({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      verbose: true,
    });
    expect(exitCodeOf(result)).toBe(0);
    const row = rowsOf(result).find((r) => String(r.name) === "unit-sha")!;
    expect(statusOf(row)).toBe("outdated");
    expect(String(row.latest)).toMatch(/v2\.0\.0/);
    expect(String(row.latest)).toMatch(new RegExp(tagCommit.slice(0, 8), "i"));
    expect(String(row.detail ?? "")).toMatch(/revision-pin/i);
  });

  test("no candidate / lightweight / missing annotated → unknown", async () => {
    project = createTempProject();
    const pin = fakeCommit("unit-pin-none");
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: unit-none\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/unit-none.git\n      ref: ${pin}\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/unit-none\n    name: unit-none\n    resolved_commit: "${pin}"\n    resolved_ref: "${pin}"\n`,
    );

    for (const tags of [
      [{ tag: "v3.0.0", commit: fakeCommit("lw"), annotated: false }],
      [{ tag: "v3.0.0", commit: fakeCommit("noflag") }],
      [],
    ] as Array<Array<{ tag: string; commit: string; annotated?: boolean }>>) {
      const ports = createFakePorts({
        tagsByRepo: { "example/unit-none": tags },
        commitsByRef: { [pin]: pin },
      });
      const result = await getRunOutdated()({
        cwd: project.cwd,
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
      });
      const row = rowsOf(result).find((r) => String(r.name) === "unit-none")!;
      expect(statusOf(row)).toBe("unknown");
    }
  });

  test("abbreviated SHA stays tip; constraint wins beside SHA resolved_ref", async () => {
    project = createTempProject();
    const locked = fakeCommit("unit-abbr-locked");
    const tipAhead = fakeCommit("unit-abbr-tip");
    const abbr = locked.slice(0, 12);
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: unit-abbr\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/unit-abbr.git\n      ref: ${abbr}\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/unit-abbr\n    name: unit-abbr\n    resolved_commit: "${locked}"\n    resolved_ref: "${abbr}"\n`,
    );
    const ports = createFakePorts({
      tagsByRepo: {
        "example/unit-abbr": [{ tag: "v9.9.9", commit: fakeCommit("ann"), annotated: true }],
      },
      commitsByRef: { [abbr]: tipAhead },
    });
    const result = await getRunOutdated()({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
    });
    const row = rowsOf(result).find((r) => String(r.name) === "unit-abbr")!;
    expect(statusOf(row)).toBe("outdated");
    expect(String(row.latest)).toMatch(new RegExp(tipAhead, "i"));
    expect(ports.tagListCalls).toEqual([]);

    // Constraint path
    project.cleanup();
    project = createTempProject();
    const cLocked = fakeCommit("unit-c-v100");
    const cNewer = fakeCommit("unit-c-v120");
    const shaPin = fakeCommit("unit-c-sha");
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: unit-c\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/unit-c.git\n      ref: "^1.0.0"\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/unit-c\n    name: unit-c\n    constraint: "^1.0.0"\n    resolved_commit: "${cLocked}"\n    resolved_tag: v1.0.0\n    resolved_ref: "${shaPin}"\n`,
    );
    const cPorts = createFakePorts({
      tagsByRepo: {
        "example/unit-c": [
          { tag: "v1.0.0", commit: cLocked, annotated: true },
          { tag: "v1.2.0", commit: cNewer, annotated: true },
        ],
      },
    });
    const cResult = await getRunOutdated()({
      cwd: project.cwd,
      gitRemote: cPorts.gitRemote,
      tagLister: cPorts.tagLister,
      verbose: true,
    });
    const cRow = rowsOf(cResult).find((r) => String(r.name) === "unit-c")!;
    expect(statusOf(cRow)).toBe("outdated");
    expect(String(cRow.latest)).toMatch(/v1\.2\.0/);
    expect(String(cRow.detail ?? "")).not.toMatch(/revision-pin/i);
  });
});
