/**
 * Acceptance (RED): install/compile help mention manifest `active`.
 * OpenSpec change: manifest-active-targets
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { createTempProject, runInProject, type TempProject } from "./helpers.ts";

describe("acceptance · manifest-active-targets · CLI help", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("install help documents --target override and manifest active", async () => {
    project = createTempProject();

    const { result, combined } = await runInProject(project.cwd, ["help", "install"]);

    expect(result).toBe(0);
    expect(combined).toMatch(/--target\s+<id>/i);
    expect(combined).toMatch(/\bactive\b/i);
  });

  test("compile help documents --target and active selection", async () => {
    project = createTempProject();

    const { result, combined } = await runInProject(project.cwd, ["compile", "--help"]);

    expect(result).toBe(0);
    expect(combined).toMatch(/--target\s+<id>/i);
    expect(combined).toMatch(/\bactive\b/i);
  });
});
