/**
 * bapmignore — publish archive acceptance (RED).
 *
 * Specs: pack-bapmignore, producer-publish.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import {
  conformingPublishManifest,
  createTempProject,
  expectRejectsMatching,
  getBuildPublishArchive,
  listZipPaths,
  plantUnreadableBapmIgnore,
  resolveArchiveBytes,
  writeBapmIgnore,
  writeManifest,
  writeText,
  zipHas,
  type TempProject,
} from "./helpers.ts";

describe("bapmignore — publish archive membership", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("missing .bapmignore still ships optional root docs", async () => {
    project = createTempProject();
    writeManifest(project.cwd, conformingPublishManifest("example/pub-no-ignore"));
    writeText(join(project.cwd, "README.md"), "# docs\n");
    writeText(join(project.cwd, ".apm", "instructions.md"), "# hello\n");

    const result = await getBuildPublishArchive()({
      cwd: project.cwd,
      dryRun: true,
    });
    const paths = listZipPaths(resolveArchiveBytes(project.cwd, result));
    expect(zipHas(paths, "apm.yml")).toBe(true);
    expect(zipHas(paths, "README.md")).toBe(true);
    expect(zipHas(paths, ".apm/instructions.md")).toBe(true);
  });

  test("publish omits ignored README.md and still emits wire apm.yml + .apm members", async () => {
    project = createTempProject();
    writeManifest(project.cwd, conformingPublishManifest("example/pub-omit-readme", "3.1.0"));
    writeBapmIgnore(project.cwd, "README.md\nCHANGELOG.md\n");
    writeText(join(project.cwd, "README.md"), "# authoring\n");
    writeText(join(project.cwd, "CHANGELOG.md"), "## 3.1.0\n");
    writeText(join(project.cwd, ".apm", "instructions.md"), "# hello\n");
    writeText(join(project.cwd, ".apm", "extra.txt"), "keep\n");

    const result = await getBuildPublishArchive()({
      cwd: project.cwd,
      dryRun: true,
    });
    const paths = listZipPaths(resolveArchiveBytes(project.cwd, result));

    expect(zipHas(paths, "README.md"), `paths: ${paths.join(", ")}`).toBe(false);
    expect(zipHas(paths, "CHANGELOG.md"), `paths: ${paths.join(", ")}`).toBe(false);
    expect(zipHas(paths, "apm.yml")).toBe(true);
    expect(zipHas(paths, ".apm/instructions.md")).toBe(true);
    expect(zipHas(paths, ".apm/extra.txt")).toBe(true);
    expect(
      paths.some((p) => p === ".bapmignore" || p.endsWith("/.bapmignore")),
      "publish zip must not ship .bapmignore",
    ).toBe(false);
  });

  test("negation keeps LICENSE.md eligible for publish docs", async () => {
    project = createTempProject();
    writeManifest(project.cwd, conformingPublishManifest("example/pub-negation"));
    writeBapmIgnore(project.cwd, "*.md\n!LICENSE.md\n");
    writeText(join(project.cwd, "CHANGELOG.md"), "notes\n");
    writeText(join(project.cwd, "LICENSE.md"), "MIT\n");
    // Non-.md under .apm so `*.md` does not empty the required publish payload.
    writeText(join(project.cwd, ".apm", "instructions.txt"), "# hello\n");

    const result = await getBuildPublishArchive()({
      cwd: project.cwd,
      dryRun: true,
    });
    const paths = listZipPaths(resolveArchiveBytes(project.cwd, result));
    expect(zipHas(paths, "CHANGELOG.md")).toBe(false);
    expect(zipHas(paths, "LICENSE.md")).toBe(true);
    expect(zipHas(paths, "apm.yml")).toBe(true);
  });

  test("ignoring all of .apm fails publish archive construction", async () => {
    project = createTempProject();
    writeManifest(project.cwd, conformingPublishManifest("example/pub-empty-apm"));
    writeBapmIgnore(project.cwd, ".apm/**\n");
    writeText(join(project.cwd, ".apm", "instructions.md"), "# hello\n");
    writeText(join(project.cwd, ".apm", "nested", "x.txt"), "x\n");
    writeText(join(project.cwd, "README.md"), "# docs\n");

    await expectRejectsMatching(
      () =>
        getBuildPublishArchive()({
          cwd: project!.cwd,
          dryRun: true,
        }),
      /\.apm|empty|no .*file|required|bapmignore|ignore|publish/i,
    );
  });

  test("wire apm.yml is never omitted via .bapmignore patterns", async () => {
    project = createTempProject();
    writeManifest(project.cwd, conformingPublishManifest("example/pub-keep-wire"));
    writeBapmIgnore(project.cwd, "apm.yml\n*.yml\n");
    writeText(join(project.cwd, ".apm", "instructions.md"), "# hello\n");

    const result = await getBuildPublishArchive()({
      cwd: project.cwd,
      dryRun: true,
    });
    const paths = listZipPaths(resolveArchiveBytes(project.cwd, result));
    expect(zipHas(paths, "apm.yml"), `paths: ${paths.join(", ")}`).toBe(true);
  });

  test("unreadable .bapmignore fails closed for publish", async () => {
    project = createTempProject();
    writeManifest(project.cwd, conformingPublishManifest("example/pub-bad-ignore"));
    plantUnreadableBapmIgnore(project.cwd);
    writeText(join(project.cwd, ".apm", "instructions.md"), "# hello\n");

    await expectRejectsMatching(
      () =>
        getBuildPublishArchive()({
          cwd: project!.cwd,
          dryRun: true,
        }),
      /bapmignore|ignore|unreadable|directory|not a file|pattern/i,
    );
  });
});
