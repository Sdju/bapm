/**
 * separate-local-lockfile — doctor / pack / publish unpublished surfaces (acceptance RED).
 *
 * Specs: doctor-basics, producer-pack-archive, producer-publish, lockfile-local-shared-split.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import {
  createTempProject,
  getBuildPublishArchive,
  getRunDoctor,
  getRunPack,
  doctorHaystack,
  exitCodeOf,
  initGitRepo,
  listZipPaths,
  minimalLockYaml,
  PERSONAL_LOCK_FILE,
  resolveArchiveBytes,
  resolvePackArtifact,
  writeManifest,
  writeText,
  type TempProject,
} from "./helpers.ts";

function conformingBase(name: string, version = "1.0.0"): string {
  return `name: ${name}\nversion: "${version}"\ndependencies:\n  apm: []\n  mcp: []\n`;
}

describe("separate-local-lockfile — doctor / pack / publish", () => {
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

  test("pack archive omits bapm.local.lock.yaml", async () => {
    project = createTempProject();
    writeManifest(project.cwd, conformingBase("pack-omit-personal-lock"));
    writeText(join(project.cwd, PERSONAL_LOCK_FILE), minimalLockYaml());
    writeText(join(project.cwd, ".apm", "note.txt"), "primitive\n");

    const result = await getRunPack()({
      cwd: project.cwd,
      archive: true,
      format: "zip",
    });
    const artifact = resolvePackArtifact(project.cwd, result);
    expect(artifact, "expected pack zip artifact").toBeTruthy();

    const paths = listZipPaths(resolveArchiveBytes(project.cwd, result));
    expect(
      paths.some((p) => p === PERSONAL_LOCK_FILE || p.endsWith(`/${PERSONAL_LOCK_FILE}`)),
      `pack zip must not include ${PERSONAL_LOCK_FILE}; got: ${paths.join(", ")}`,
    ).toBe(false);
    expect(paths.some((p) => p === "bapm.yml" || p.endsWith("/bapm.yml") || p === "apm.yml")).toBe(
      true,
    );
  });

  test("publish archive omits bapm.local.lock.yaml", async () => {
    project = createTempProject();
    writeManifest(project.cwd, conformingBase("example/pub-omit-personal-lock", "2.0.0"));
    writeText(join(project.cwd, PERSONAL_LOCK_FILE), minimalLockYaml());
    // Also plant under .apm/ to prove collectors that walk trees still skip the basename.
    writeText(join(project.cwd, ".apm", PERSONAL_LOCK_FILE), minimalLockYaml());
    writeText(join(project.cwd, ".apm", "instructions.md"), "# hello\n");

    const result = await getBuildPublishArchive()({
      cwd: project.cwd,
      dryRun: true,
    });
    const paths = listZipPaths(resolveArchiveBytes(project.cwd, result));
    expect(
      paths.some(
        (p) =>
          p === PERSONAL_LOCK_FILE ||
          p.endsWith(`/${PERSONAL_LOCK_FILE}`) ||
          p.includes(PERSONAL_LOCK_FILE),
      ),
      `publish zip must not include ${PERSONAL_LOCK_FILE}; got: ${paths.join(", ")}`,
    ).toBe(false);
  });
});
