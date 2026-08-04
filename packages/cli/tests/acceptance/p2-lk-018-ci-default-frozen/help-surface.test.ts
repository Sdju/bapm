/**
 * p2-lk-018: install help documents --no-frozen and CI-default frozen.
 * Spec: cli-runtime-surface — Install help documents --no-frozen and CI default.
 */
import { expect, test } from "vite-plus/test";
import { createTempProject, runInProject } from "./helpers.ts";

test("install help documents --no-frozen and truthy CI default frozen", async () => {
  const project = createTempProject();
  try {
    const viaInstallHelp = await runInProject(project.cwd, ["install", "--help"]);
    const viaHelpInstall = await runInProject(project.cwd, ["help", "install"]);
    const text = [viaInstallHelp.combined, viaHelpInstall.combined].join("\n");

    expect(viaInstallHelp.result === 0 || viaHelpInstall.result === 0).toBe(true);
    expect(text).not.toMatch(/\(stub\)|not implemented/i);
    expect(text).toMatch(/--frozen/);
    expect(text).toMatch(/--no-frozen/);
    expect(text).toMatch(/\bCI\b/);
    expect(text).toMatch(/frozen/i);
  } finally {
    project.cleanup();
  }
});
