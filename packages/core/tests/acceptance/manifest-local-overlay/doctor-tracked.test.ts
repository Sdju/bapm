/**
 * Doctor warns when bapm.local.yml is git-tracked (non-critical).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  conformingBase,
  createTempProject,
  doctorHaystack,
  exitCodeOf,
  getRunDoctor,
  initGitRepo,
  writeBaseManifest,
  writeLocalOverlay,
  type TempProject,
} from "./helpers.ts";

describe("manifest-local-overlay — doctor tracked warning", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("tracked bapm.local.yml warns without forcing non-zero exit", async () => {
    project = createTempProject();
    writeBaseManifest(project.cwd, conformingBase({ name: "doctor-tracked" }));
    writeLocalOverlay(project.cwd, "active:\n  - cursor\n");
    initGitRepo(project.cwd, { trackLocal: true });

    const result = await getRunDoctor()({
      cwd: project.cwd,
      gitAvailable: true,
      hasGit: true,
    });

    expect(exitCodeOf(result)).toBe(0);
    expect(doctorHaystack(result)).toMatch(/bapm\.local\.yml/i);
    expect(doctorHaystack(result)).toMatch(/warn|tracked|git\s*rm|--cached|gitignore/i);
  });

  test("untracked bapm.local.yml does not report tracked-overlay warning", async () => {
    project = createTempProject();
    writeBaseManifest(project.cwd, conformingBase({ name: "doctor-untracked" }));
    writeLocalOverlay(project.cwd, "active:\n  - cursor\n");
    initGitRepo(project.cwd, { trackLocal: false });

    const result = await getRunDoctor()({
      cwd: project.cwd,
      gitAvailable: true,
      hasGit: true,
    });

    expect(exitCodeOf(result)).toBe(0);
    const hay = doctorHaystack(result);
    const trackedWarning =
      /bapm\.local\.yml/i.test(hay) && /tracked|indexed|git\s*rm|--cached/i.test(hay);
    expect(trackedWarning, "must not claim untracked local overlay is indexed").toBe(false);
  });
});
