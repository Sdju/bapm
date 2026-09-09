/**
 * Pack / publish must omit bapm.local.lock.yaml
 * (promoted from separate-local-lockfile acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import {
  createTempProject,
  getBuildPublishArchive,
  getRunPack,
  listZipPaths,
  minimalLockYaml,
  PERSONAL_LOCK_FILE,
  resolveArchiveBytes,
  resolvePackArtifact,
  writeManifest,
  writeText,
  type TempProject,
} from "../lockfile/separate-local-lockfile-helpers.ts";

function conformingBase(name: string, version = "1.0.0"): string {
  return `name: ${name}\nversion: "${version}"\ndependencies:\n  apm: []\n  mcp: []\n`;
}

describe("separate-local-lockfile — unpublished personal lock", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
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
