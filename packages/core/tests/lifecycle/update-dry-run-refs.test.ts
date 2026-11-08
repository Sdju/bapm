/**
 * Core update dry-run — mutable branch/tag refs resolve like apply.
 */
import { asText } from "../asText.ts";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createFakePorts,
  createTempProject,
  fakeCommit,
  getRunUpdate,
  planOf,
  readLockBytes,
  textOf,
  writeLock,
  writeManifest,
  type TempProject,
} from "./helpers.ts";

describe("core update dry-run — mutable refs", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("branch lock pinned at A with remote tip B plans update A→B without mutation", async () => {
    project = createTempProject();
    const locked = fakeCommit("branch-locked-a");
    const tip = fakeCommit("branch-tip-b");
    const ports = createFakePorts({
      commitsByRef: { main: tip },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: dry-run-branch\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/branch.git\n      ref: main\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/branch\n    name: branch\n    resolved_commit: "${locked}"\n    resolved_ref: main\n`,
    );
    const before = readLockBytes(project.cwd);

    const result = await getRunUpdate()({
      cwd: project.cwd,
      dryRun: true,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    const row = planOf(result).find((p) => asText(p.name) === "branch");
    expect(row).toBeTruthy();
    expect(row!.action).toBe("update");
    expect(row!.from).toBe(locked);
    expect(row!.to).toBe(tip);
    expect(textOf(result)).toMatch(new RegExp(`${locked}.*→.*${tip}`));
    expect(ports.lsRemoteCalls.some((c) => c.endsWith("#main"))).toBe(true);
    expect(Buffer.compare(readLockBytes(project.cwd), before)).toBe(0);
  });

  test("branch tip equal to lock commit stays keep", async () => {
    project = createTempProject();
    const locked = fakeCommit("branch-same");
    const ports = createFakePorts({
      commitsByRef: { main: locked },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: dry-run-branch-keep\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/branch-keep.git\n      ref: main\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/branch-keep\n    name: branch-keep\n    resolved_commit: "${locked}"\n    resolved_ref: main\n`,
    );

    const result = await getRunUpdate()({
      cwd: project.cwd,
      dryRun: true,
      verbose: true,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    const row = planOf(result).find((p) => asText(p.name) === "branch-keep");
    expect(row).toBeTruthy();
    expect(row!.action).toBe("keep");
    expect(row!.from).toBe(locked);
    expect(row!.to).toBe(locked);
    expect(textOf(result)).toMatch(/branch-keep keep/);
  });

  test("unresolvable literal tag stays keep with a verbose note (no crash)", async () => {
    project = createTempProject();
    const locked = fakeCommit("tag-locked");
    const ports = createFakePorts({
      failUrls: ["example/tag-fail"],
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: dry-run-tag-fail\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/tag-fail.git\n      ref: release\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/tag-fail\n    name: tag-fail\n    resolved_commit: "${locked}"\n    resolved_ref: release\n`,
    );
    const before = readLockBytes(project.cwd);

    const result = await getRunUpdate()({
      cwd: project.cwd,
      dryRun: true,
      verbose: true,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    const row = planOf(result).find((p) => asText(p.name) === "tag-fail");
    expect(row).toBeTruthy();
    expect(row!.action).toBe("keep");
    expect(asText(row!.note)).toMatch(/unable to resolve ref release/i);
    expect(textOf(result)).toMatch(/tag-fail keep — unable to resolve ref release/i);
    expect(Buffer.compare(readLockBytes(project.cwd), before)).toBe(0);
  });
});
