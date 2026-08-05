/**
 * Core outdated — full-SHA resolved_ref uses annotated-tag revision pin.
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
  shortSha,
  statusOf,
  writeFullShaPinFixture,
  writeLock,
  writeManifest,
  type TempProject,
} from "./helpers.ts";

describe("core outdated — SHA revision-pin (annotated tag)", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("full-SHA pin with newer annotated tag is outdated (not self-tip up-to-date)", async () => {
    project = createTempProject();
    const pin = fakeCommit("p7g-pin-old");
    const tagCommit = fakeCommit("p7g-tag-v200");
    writeFullShaPinFixture(project.cwd, {
      name: "sha-drift",
      repo: "example/sha-drift",
      pinSha: pin,
    });
    const ports = createRevisionPinPorts({
      tagsByRepo: {
        "example/sha-drift": [
          { tag: "v1.0.0", commit: pin, annotated: true },
          { tag: "v2.0.0", commit: tagCommit, annotated: true },
        ],
      },
      // Tip-of-pin-SHA would self-resolve — must NOT be the sole latest.
      commitsByRef: { [pin]: pin },
    });

    const result = await getRunOutdated()({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      verbose: true,
    });

    expect(exitCodeOf(result)).toBe(0);
    const row = findRowByName(rowsOf(result), "sha-drift");
    expect(row).toBeTruthy();
    expect(statusOf(row!)).toBe("outdated");
    expect(ports.tagListCalls.length).toBeGreaterThan(0);

    const latest = String(row!.latest ?? "");
    expect(latest).toMatch(/v2\.0\.0/);
    expect(latest).toMatch(new RegExp(shortSha(tagCommit), "i"));
    expect(String(row!.tip_ref ?? "")).toMatch(/v2\.0\.0/);
    expect(String(row!.detail ?? "")).toMatch(/revision-pin/i);
    // Must not silently treat pin SHA tip as up-to-date.
    expect(statusOf(row!)).not.toBe("up-to-date");
  });

  test("full-SHA pin matching latest annotated tag commit is up-to-date", async () => {
    project = createTempProject();
    const tagCommit = fakeCommit("p7g-match-v150");
    // Gate uses resolved_ref (case-insensitive); commit may already be lower.
    const pinUpper = tagCommit.toUpperCase();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: p7g-sha-match
version: 0.0.1
dependencies:
  apm:
    - git: https://github.com/example/sha-match.git
      ref: ${pinUpper}
`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"
dependencies:
  - repo_url: github.com/example/sha-match
    name: sha-match
    resolved_commit: "${tagCommit}"
    resolved_ref: "${pinUpper}"
`,
    );
    const ports = createRevisionPinPorts({
      tagsByRepo: {
        "example/sha-match": [
          { tag: "v1.0.0", commit: fakeCommit("p7g-older"), annotated: true },
          { tag: "v1.5.0", commit: tagCommit, annotated: true },
          { tag: "v2.0.0-rc.1", commit: fakeCommit("p7g-prerelease"), annotated: true },
        ],
      },
    });

    const result = await getRunOutdated()({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      verbose: true,
    });

    expect(exitCodeOf(result)).toBe(0);
    const row = findRowByName(rowsOf(result), "sha-match");
    expect(row).toBeTruthy();
    expect(statusOf(row!)).toBe("up-to-date");
    expect(ports.tagListCalls.length).toBeGreaterThan(0);

    const latest = String(row!.latest ?? "");
    expect(latest).toMatch(/v1\.5\.0/);
    expect(latest).toMatch(new RegExp(shortSha(tagCommit), "i"));
    expect(latest).not.toMatch(/v2\.0\.0-rc/);
    expect(String(row!.tip_ref ?? "")).toMatch(/v1\.5\.0/);
    expect(String(row!.detail ?? "")).toMatch(/revision-pin/i);
  });

  test("no annotated semver candidate yields unknown (not self-tip up-to-date)", async () => {
    project = createTempProject();
    const pin = fakeCommit("p7g-pin-alone");
    writeFullShaPinFixture(project.cwd, {
      name: "sha-none",
      repo: "example/sha-none",
      pinSha: pin,
    });
    const ports = createRevisionPinPorts({
      tagsByRepo: {
        "example/sha-none": [
          // Only prereleases — no eligible non-prerelease annotated candidate.
          { tag: "v2.0.0-beta.1", commit: fakeCommit("p7g-beta"), annotated: true },
        ],
      },
      commitsByRef: { [pin]: pin },
    });

    const result = await getRunOutdated()({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
    });

    expect(exitCodeOf(result)).toBe(0);
    const row = findRowByName(rowsOf(result), "sha-none");
    expect(row).toBeTruthy();
    expect(statusOf(row!)).toBe("unknown");
    expect(statusOf(row!)).not.toBe("up-to-date");
  });

  test("empty annotated set yields unknown", async () => {
    project = createTempProject();
    const pin = fakeCommit("p7g-pin-empty");
    writeFullShaPinFixture(project.cwd, {
      name: "sha-empty",
      repo: "example/sha-empty",
      pinSha: pin,
    });
    const ports = createRevisionPinPorts({
      tagsByRepo: { "example/sha-empty": [] },
      commitsByRef: { [pin]: pin },
    });

    const result = await getRunOutdated()({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
    });

    expect(exitCodeOf(result)).toBe(0);
    const row = findRowByName(rowsOf(result), "sha-empty");
    expect(row).toBeTruthy();
    expect(statusOf(row!)).toBe("unknown");
  });

  test("lightweight tag cannot spoof annotated latest → unknown", async () => {
    project = createTempProject();
    const pin = fakeCommit("p7g-pin-lw");
    const lwCommit = fakeCommit("p7g-lw-v300");
    writeFullShaPinFixture(project.cwd, {
      name: "sha-lw",
      repo: "example/sha-lw",
      pinSha: pin,
    });
    const ports = createRevisionPinPorts({
      tagsByRepo: {
        "example/sha-lw": [
          // Higher semver-looking lightweight — no peel / annotated=false.
          { tag: "v3.0.0", commit: lwCommit, annotated: false },
          { tag: "v1.0.0", commit: pin, annotated: false },
        ],
      },
      commitsByRef: { [pin]: pin },
    });

    const result = await getRunOutdated()({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
    });

    expect(exitCodeOf(result)).toBe(0);
    const row = findRowByName(rowsOf(result), "sha-lw");
    expect(row).toBeTruthy();
    expect(statusOf(row!)).toBe("unknown");
    const blob = JSON.stringify(row);
    expect(blob).not.toMatch(/v3\.0\.0/);
    expect(statusOf(row!)).not.toBe("outdated");
    expect(statusOf(row!)).not.toBe("up-to-date");
  });

  test("missing annotated flag (peel unknown) is fail-closed unknown", async () => {
    project = createTempProject();
    const pin = fakeCommit("p7g-pin-noflag");
    const newer = fakeCommit("p7g-noflag-v200");
    writeFullShaPinFixture(project.cwd, {
      name: "sha-noflag",
      repo: "example/sha-noflag",
      pinSha: pin,
    });
    // No `annotated` property — transport cannot prove peel.
    const ports = createRevisionPinPorts({
      tagsByRepo: {
        "example/sha-noflag": [
          { tag: "v1.0.0", commit: pin },
          { tag: "v2.0.0", commit: newer },
        ],
      },
      commitsByRef: { [pin]: pin },
    });

    const result = await getRunOutdated()({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
    });

    expect(exitCodeOf(result)).toBe(0);
    const row = findRowByName(rowsOf(result), "sha-noflag");
    expect(row).toBeTruthy();
    expect(statusOf(row!)).toBe("unknown");
  });
});
