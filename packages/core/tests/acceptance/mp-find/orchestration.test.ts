/**
 * Offline find orchestration exits 0/1/2 (find-reverse-index).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  invokeFind,
  sampleFindLockYaml,
  writeLock,
  writeManifest,
  type TempProject,
} from "./helpers.ts";

describe("mp-find orchestration exits", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("tracked path is success (exit 0) with owner lines", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "mp-find-ok");
    writeLock(project.cwd, sampleFindLockYaml());

    const result = await invokeFind({
      cwd: project.cwd,
      path: "AGENTS.md",
      query: "AGENTS.md",
    });
    expect(result.exitCode).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.text).toMatch(/alpha|beta|example\.com/i);
  });

  test("unknown path is exit 1 without inventing an owner", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "mp-find-miss");
    writeLock(project.cwd, sampleFindLockYaml());

    const result = await invokeFind({
      cwd: project.cwd,
      path: "not-tracked.txt",
      query: "not-tracked.txt",
    });
    expect(result.exitCode).toBe(1);
    expect(result.text).not.toMatch(/https:\/\/example\.com\/org\/alpha\.git/);
  });

  test("missing lock is exit 2 mentioning bapm.lock.yaml", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "mp-find-nolock");

    const result = await invokeFind({
      cwd: project.cwd,
      path: "anything",
      query: "anything",
    });
    expect(result.exitCode).toBe(2);
    const combined = `${result.text}\n${result.stderr}`;
    expect(combined).toMatch(/bapm\.lock\.yaml/i);
  });
});
