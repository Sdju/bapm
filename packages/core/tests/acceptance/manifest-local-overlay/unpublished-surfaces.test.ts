/**
 * Pack / publish must omit bapm.local.yml (unpublished personal overlay).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import {
  conformingBase,
  createTempProject,
  getBuildPublishArchive,
  getRunPack,
  listZipPaths,
  resolveArchiveBytes,
  resolvePackArtifact,
  writeBaseManifest,
  writeLocalOverlay,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("manifest-local-overlay — unpublished surfaces", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("pack archive omits bapm.local.yml", async () => {
    project = createTempProject();
    writeBaseManifest(project.cwd, conformingBase({ name: "pack-omit", version: "1.0.0" }));
    writeLocalOverlay(project.cwd, "active:\n  - cursor\n");
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
      paths.some((p) => p === "bapm.local.yml" || p.endsWith("/bapm.local.yml")),
      `pack zip must not include bapm.local.yml; got: ${paths.join(", ")}`,
    ).toBe(false);
    expect(paths.some((p) => p === "bapm.yml" || p.endsWith("/bapm.yml") || p === "apm.yml")).toBe(
      true,
    );
  });

  test("publish archive omits bapm.local.yml", async () => {
    project = createTempProject();
    writeBaseManifest(project.cwd, conformingBase({ name: "example/pub-omit", version: "2.0.0" }));
    writeLocalOverlay(project.cwd, 'env:\n  SECRETISH: "nope"\n');
    writeText(join(project.cwd, ".apm", "instructions.md"), "# hello\n");

    const result = await getBuildPublishArchive()({
      cwd: project.cwd,
      dryRun: true,
    });
    const paths = listZipPaths(resolveArchiveBytes(project.cwd, result));
    expect(
      paths.some((p) => p === "bapm.local.yml" || p.endsWith("/bapm.local.yml")),
      `publish zip must not include bapm.local.yml; got: ${paths.join(", ")}`,
    ).toBe(false);
  });
});
