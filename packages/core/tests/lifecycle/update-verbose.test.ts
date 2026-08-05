/**
 * Unit: update plan verbosity + parallelDownloads: 0 wiring.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createFakePorts,
  createTempProject,
  fakeCommit,
  getRunUpdate,
  writeLock,
  writeManifest,
  writeText,
  type TempProject,
} from "./helpers.ts";
import { join } from "node:path";

function textOf(result: unknown): string {
  if (result && typeof result === "object" && typeof (result as { text?: unknown }).text === "string") {
    return (result as { text: string }).text;
  }
  return String(result ?? "");
}

function planOf(result: unknown): Array<{ action?: string }> {
  if (result && typeof result === "object" && Array.isArray((result as { plan?: unknown }).plan)) {
    return (result as { plan: Array<{ action?: string }> }).plan;
  }
  return [];
}

describe("core update — verbose plan + parallelDownloads unit", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("quiet dry-run omits keep rows; verbose includes them", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: unit-verbose\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
    );
    writeText(
      join(project.cwd, "leaf", "apm.yml"),
      `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n`,
    );

    const runUpdate = getRunUpdate();
    const quiet = await runUpdate({ cwd: project.cwd, dryRun: true });
    expect(textOf(quiet)).toMatch(/no dependency changes/i);
    expect(textOf(quiet)).not.toMatch(/\[=\].*\bkeep\b/i);
    expect(planOf(quiet).some((p) => p.action === "keep")).toBe(true);

    const verbose = await runUpdate({ cwd: project.cwd, dryRun: true, verbose: true });
    expect(textOf(verbose)).toMatch(/\[=\].*\bkeep\b/i);
  });

  test("parallelDownloads: 0 reaches mutating resolve path", async () => {
    project = createTempProject();
    const commit = fakeCommit("unit-pd0");
    const ports = createFakePorts({
      tagsByRepo: {
        "example/pkg-a": [{ tag: "v1.0.0", commit }],
      },
    });

    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: unit-pd0\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/pkg-a.git\n      ref: "^1.0.0"\n`,
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
    expect(ports.downloadCalls.length).toBeGreaterThan(0);
  });
});
