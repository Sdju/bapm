/**
 * Pack archive membership with project-root `.bapmignore`.
 *
 * Specs: pack-bapmignore, producer-pack-archive.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import {
  conformingManifest,
  createTempProject,
  expectRejectsMatching,
  filesPackedOf,
  getRunPack,
  listZipPaths,
  plantUnreadableBapmIgnore,
  resolveArchiveBytes,
  resolvePackArtifact,
  tryGetCollectPackFiles,
  writeBapmIgnore,
  writeManifest,
  writeText,
  zipHas,
  type TempProject,
} from "./bapmignore-helpers.ts";

describe("bapmignore — pack archive membership", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("missing .bapmignore leaves pack membership on baseline hard excludes only", async () => {
    project = createTempProject();
    writeManifest(project.cwd, conformingManifest("pack-no-ignore"));
    writeText(join(project.cwd, "README.md"), "# hi\n");
    writeText(join(project.cwd, ".apm", "note.txt"), "primitive\n");
    writeText(join(project.cwd, ".gitignore"), "README.md\n");

    const result = await getRunPack()({
      cwd: project.cwd,
      archive: true,
      format: "zip",
    });
    const paths = listZipPaths(resolveArchiveBytes(project.cwd, result));

    expect(zipHas(paths, "bapm.yml")).toBe(true);
    expect(zipHas(paths, "README.md")).toBe(true);
    // .gitignore is not a substitute for .bapmignore
    expect(zipHas(paths, ".gitignore")).toBe(true);
  });

  test("nested .bapmignore under subdirectory is not loaded", async () => {
    project = createTempProject();
    writeManifest(project.cwd, conformingManifest("pack-nested-ignore"));
    writeText(join(project.cwd, "README.md"), "# root readme\n");
    writeText(join(project.cwd, "skills", "foo", ".bapmignore"), "README.md\n");
    writeText(join(project.cwd, ".apm", "note.txt"), "ok\n");

    const result = await getRunPack()({
      cwd: project.cwd,
      archive: true,
      format: "zip",
    });
    const paths = listZipPaths(resolveArchiveBytes(project.cwd, result));
    expect(zipHas(paths, "README.md")).toBe(true);
  });

  test("pack zip omits ignored CHANGELOG.md and docs/**; keeps root manifest", async () => {
    project = createTempProject();
    writeManifest(project.cwd, conformingManifest("pack-omit-docs", "2.0.0"));
    writeBapmIgnore(project.cwd, "CHANGELOG.md\ndocs/**\n");
    writeText(join(project.cwd, "CHANGELOG.md"), "## 2.0.0\n");
    writeText(join(project.cwd, "docs", "guide.md"), "# guide\n");
    writeText(join(project.cwd, "docs", "nested", "a.md"), "a\n");
    writeText(join(project.cwd, "README.md"), "# keep\n");
    writeText(join(project.cwd, ".apm", "note.txt"), "primitive\n");

    const result = await getRunPack()({
      cwd: project.cwd,
      archive: true,
      format: "zip",
    });
    const artifact = resolvePackArtifact(project.cwd, result);
    expect(artifact, "expected durable pack zip").toBeTruthy();

    const paths = listZipPaths(resolveArchiveBytes(project.cwd, result));
    expect(zipHas(paths, "CHANGELOG.md"), `paths: ${paths.join(", ")}`).toBe(false);
    expect(
      paths.some((p) => p === "docs" || p.startsWith("docs/") || p.includes("/docs/")),
      `docs members must be omitted; got: ${paths.join(", ")}`,
    ).toBe(false);
    expect(zipHas(paths, "README.md")).toBe(true);
    expect(zipHas(paths, "bapm.yml")).toBe(true);
  });

  test("README.md pattern omits root README from pack zip", async () => {
    project = createTempProject();
    writeManifest(project.cwd, conformingManifest("pack-omit-readme"));
    writeBapmIgnore(project.cwd, "README.md\n");
    writeText(join(project.cwd, "README.md"), "# secret authoring notes\n");
    writeText(join(project.cwd, ".apm", "note.txt"), "ok\n");

    const result = await getRunPack()({
      cwd: project.cwd,
      archive: true,
      format: "zip",
    });
    const paths = listZipPaths(resolveArchiveBytes(project.cwd, result));
    expect(zipHas(paths, "README.md"), `paths: ${paths.join(", ")}`).toBe(false);
    expect(zipHas(paths, "bapm.yml")).toBe(true);
  });

  test("negation re-includes LICENSE.md after *.md", async () => {
    project = createTempProject();
    writeManifest(project.cwd, conformingManifest("pack-negation"));
    writeBapmIgnore(project.cwd, "*.md\n!LICENSE.md\n");
    writeText(join(project.cwd, "CHANGELOG.md"), "notes\n");
    writeText(join(project.cwd, "LICENSE.md"), "MIT\n");
    writeText(join(project.cwd, ".apm", "note.txt"), "ok\n");

    const result = await getRunPack()({
      cwd: project.cwd,
      archive: true,
      format: "zip",
    });
    const paths = listZipPaths(resolveArchiveBytes(project.cwd, result));
    expect(zipHas(paths, "CHANGELOG.md"), `paths: ${paths.join(", ")}`).toBe(false);
    expect(zipHas(paths, "LICENSE.md"), `paths: ${paths.join(", ")}`).toBe(true);
  });

  test(".bapmignore itself is never shipped in the pack zip", async () => {
    project = createTempProject();
    writeManifest(project.cwd, conformingManifest("pack-no-ship-ignore"));
    writeBapmIgnore(project.cwd, "README.md\n");
    writeText(join(project.cwd, "README.md"), "# x\n");
    writeText(join(project.cwd, ".apm", "note.txt"), "ok\n");

    const result = await getRunPack()({
      cwd: project.cwd,
      archive: true,
      format: "zip",
    });
    const paths = listZipPaths(resolveArchiveBytes(project.cwd, result));
    expect(
      paths.some((p) => p === ".bapmignore" || p.endsWith("/.bapmignore")),
      `archive must not contain .bapmignore; got: ${paths.join(", ")}`,
    ).toBe(false);
  });

  test("pattern cannot drop root dual-read manifest from pack", async () => {
    project = createTempProject();
    writeManifest(project.cwd, conformingManifest("pack-keep-manifest"));
    writeBapmIgnore(project.cwd, "bapm.yml\n*\n");
    writeText(join(project.cwd, ".apm", "note.txt"), "ok\n");
    writeText(join(project.cwd, "README.md"), "# x\n");

    const result = await getRunPack()({
      cwd: project.cwd,
      archive: true,
      format: "zip",
    });
    const paths = listZipPaths(resolveArchiveBytes(project.cwd, result));
    expect(
      zipHas(paths, "bapm.yml") || zipHas(paths, "apm.yml"),
      `root manifest must remain; got: ${paths.join(", ")}`,
    ).toBe(true);
  });

  test("ignored .env does not secret-refuse and is omitted from pack", async () => {
    project = createTempProject();
    writeManifest(project.cwd, conformingManifest("pack-ignore-env"));
    writeBapmIgnore(project.cwd, ".env\n");
    writeText(join(project.cwd, ".env"), "SECRET=do-not-pack\n");
    writeText(join(project.cwd, ".apm", "note.txt"), "ok\n");

    const result = await getRunPack()({
      cwd: project.cwd,
      archive: true,
      format: "zip",
    });
    const artifact = resolvePackArtifact(project.cwd, result);
    expect(artifact, "pack must succeed without secret-refuse").toBeTruthy();

    const paths = listZipPaths(resolveArchiveBytes(project.cwd, result));
    expect(zipHas(paths, ".env")).toBe(false);
  });

  test("unreadable .bapmignore fails closed — no successful pack archive", async () => {
    project = createTempProject();
    writeManifest(project.cwd, conformingManifest("pack-bad-ignore"));
    plantUnreadableBapmIgnore(project.cwd);
    writeText(join(project.cwd, ".apm", "note.txt"), "ok\n");

    await expectRejectsMatching(
      () =>
        getRunPack()({
          cwd: project!.cwd,
          archive: true,
          format: "zip",
        }),
      /bapmignore|ignore|unreadable|directory|not a file|pattern/i,
    );
    expect(resolvePackArtifact(project.cwd)).toBeUndefined();
  });

  test("pack --dry-run applies the same omit set and leaves no durable archive", async () => {
    project = createTempProject();
    writeManifest(project.cwd, conformingManifest("pack-dry-omit"));
    writeText(join(project.cwd, "README.md"), "# omit-me\n");
    writeText(join(project.cwd, "KEEP.txt"), "keep\n");
    writeText(join(project.cwd, ".apm", "note.txt"), "ok\n");
    // Same on-disk file present for both runs so filesPacked delta is ignore-only.
    writeBapmIgnore(project.cwd, "# no omit patterns yet\n");

    const baseline = await getRunPack()({
      cwd: project.cwd,
      archive: true,
      dryRun: true,
    });
    expect(resolvePackArtifact(project.cwd)).toBeUndefined();

    writeBapmIgnore(project.cwd, "README.md\n");
    const omitted = await getRunPack()({
      cwd: project.cwd,
      archive: true,
      dryRun: true,
    });
    expect(resolvePackArtifact(project.cwd)).toBeUndefined();

    const collect = tryGetCollectPackFiles();
    if (collect) {
      const rels = collect(project.cwd).map((e) => e.relativePath.replace(/\\/g, "/"));
      expect(rels.includes("README.md"), `collect set: ${rels.join(", ")}`).toBe(false);
      expect(rels.includes("bapm.yml") || rels.includes("apm.yml")).toBe(true);
      expect(rels.includes(".bapmignore")).toBe(false);
    } else {
      const baseCount = filesPackedOf(baseline);
      const omitCount = filesPackedOf(omitted);
      expect(baseCount, "dry-run should report filesPacked").toBeTypeOf("number");
      expect(omitCount, "dry-run should report filesPacked").toBeTypeOf("number");
      // README omitted (+ .bapmignore always-omit once wired) → strictly fewer packed files.
      expect(omitCount!).toBeLessThan(baseCount!);
    }
  });
});
