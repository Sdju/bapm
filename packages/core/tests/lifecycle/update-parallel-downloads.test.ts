/**
 * Core update parallelDownloads default 4 / 0 = serial (lifecycle-update).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { DEFAULT_PARALLEL_DOWNLOADS } from "@bapm/core";
import {
  createFakePorts,
  createTempProject,
  fakeCommit,
  getRunUpdate,
  readUpdateRunSource,
  readUpdateTypesSource,
  writeLock,
  writeManifest,
  type TempProject,
} from "./helpers.ts";

describe("core update parallelDownloads", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("RunUpdateOptions includes parallelDownloads; APM default is 4", () => {
    expect(readUpdateTypesSource()).toMatch(/\bparallelDownloads\??\s*:/);
    expect(DEFAULT_PARALLEL_DOWNLOADS).toBe(4);
    expect(readUpdateRunSource()).toMatch(/parallelDownloads:\s*options\.parallelDownloads/);
  });

  test("parallelDownloads 0 is accepted on mutating update (serial)", async () => {
    project = createTempProject();
    const commit = fakeCommit("update-pd0");
    const ports = createFakePorts({
      tagsByRepo: {
        "example/pkg-a": [{ tag: "v1.0.0", commit }],
      },
    });

    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: update-pd0\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/pkg-a.git\n      ref: "^1.0.0"\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/pkg-a\n    name: pkg-a\n    resolved_commit: "${commit}"\n    resolved_tag: v1.0.0\n`,
    );

    const runUpdate = getRunUpdate();
    const result = await runUpdate({
      cwd: project.cwd,
      yes: true,
      parallelDownloads: 0,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    const r = result as { ok?: boolean; exitCode?: number };
    expect(r.ok === true || r.exitCode === 0).toBe(true);
  });
});
