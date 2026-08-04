/**
 * M6 core doctor basics — checklist C §22–23.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import {
  createTempProject,
  exitCodeOf,
  getRunDoctor,
  textOf,
  writeLock,
  writeManifest,
  type TempProject,
} from "./helpers.ts";

describe("M6 core doctor basics", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("§22 doctor with git available exits 0 when artifacts sane", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: doctor-ok\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );
    writeLock(project.cwd, "bapm.lock.yaml", `lockfile_version: "1"\ndependencies: []\n`);

    const result = await getRunDoctor()({
      cwd: project.cwd,
      // injectable probe — apply may honor any of these
      gitAvailable: true,
      hasGit: true,
      whichGit: () => "/usr/bin/git",
    });
    expect(exitCodeOf(result)).toBe(0);
    expect(`${textOf(result)}\n${JSON.stringify(result)}`).toMatch(/git/i);
  });

  test("§23 doctor with git missing exits non-zero", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: doctor-nogit\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );

    const result = await getRunDoctor()({
      cwd: project.cwd,
      gitAvailable: false,
      hasGit: false,
      whichGit: () => null,
      findGit: () => undefined,
    });
    expect(exitCodeOf(result)).not.toBe(0);
    expect(`${textOf(result)}\n${JSON.stringify(result)}`).toMatch(/git/i);
  });
});
