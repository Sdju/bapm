/**
 * Doctor warns when bapm.local.lock.yaml is git-tracked (non-critical)
 * (promoted from separate-local-lockfile acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import {
  createTempProject,
  doctorHaystack,
  exitCodeOf,
  getRunDoctor,
  initGitRepo,
  minimalLockYaml,
  PERSONAL_LOCK_FILE,
  writeManifest,
  writeText,
  type TempProject,
} from "../lockfile/separate-local-lockfile-helpers.ts";

function conformingBase(name: string, version = "1.0.0"): string {
  return `name: ${name}\nversion: "${version}"\ndependencies:\n  apm: []\n  mcp: []\n`;
}

describe("separate-local-lockfile — doctor tracked warning", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("tracked bapm.local.lock.yaml warns without forcing non-zero exit", async () => {
    project = createTempProject();
    writeManifest(project.cwd, conformingBase("doctor-tracked-personal-lock"));
    writeText(join(project.cwd, PERSONAL_LOCK_FILE), minimalLockYaml());
    initGitRepo(project.cwd, { trackPersonalLock: true });

    const result = await getRunDoctor()({
      cwd: project.cwd,
      gitAvailable: true,
      hasGit: true,
    });

    expect(exitCodeOf(result)).toBe(0);
    expect(doctorHaystack(result)).toMatch(/bapm\.local\.lock\.yaml/i);
    expect(doctorHaystack(result)).toMatch(/warn|tracked|git\s*rm|--cached|gitignore/i);
  });

  test("untracked personal lock does not warn as tracked", async () => {
    project = createTempProject();
    writeManifest(project.cwd, conformingBase("doctor-untracked-personal-lock"));
    writeText(join(project.cwd, PERSONAL_LOCK_FILE), minimalLockYaml());
    initGitRepo(project.cwd, { trackPersonalLock: false });

    const result = await getRunDoctor()({
      cwd: project.cwd,
      gitAvailable: true,
      hasGit: true,
    });

    expect(exitCodeOf(result)).toBe(0);
    const hay = doctorHaystack(result);
    const trackedWarning =
      /bapm\.local\.lock\.yaml/i.test(hay) && /tracked|indexed|git\s*rm|--cached/i.test(hay);
    expect(trackedWarning, "must not claim untracked personal lock is indexed").toBe(false);
  });
});
