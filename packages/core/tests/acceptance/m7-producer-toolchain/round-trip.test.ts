/**
 * M7 core — pack → extractPackArchive round-trip (checklist C §17).
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  documentOf,
  getExtractPackArchive,
  getLoadManifest,
  getRunPack,
  resolvePackArtifact,
  writeConformingManifest,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("M7 round-trip — pack zip → extract → loadManifest", () => {
  let source: TempProject;
  let dest: TempProject;

  afterEach(() => {
    source?.cleanup();
    dest?.cleanup();
  });

  test("§17 extractPackArchive lands parseable manifest under output", async () => {
    source = createTempProject("bapm-m7-rt-src-");
    dest = createTempProject("bapm-m7-rt-dst-");
    writeConformingManifest(source.cwd, { name: "rt-pkg", version: "3.1.4" });
    writeText(join(source.cwd, ".apm", "keep.txt"), "packed\n");

    const packResult = await getRunPack()({
      cwd: source.cwd,
      archive: true,
    });
    const artifact = resolvePackArtifact(source.cwd, packResult);
    expect(artifact).toBeTruthy();

    await getExtractPackArchive()({
      archivePath: artifact,
      path: artifact,
      cwd: dest.cwd,
      outputDir: dest.cwd,
      dest: dest.cwd,
    });

    const hasManifest =
      existsSync(join(dest.cwd, "bapm.yml")) || existsSync(join(dest.cwd, "apm.yml"));
    expect(hasManifest).toBe(true);

    const loaded = getLoadManifest()({ cwd: dest.cwd });
    const doc = documentOf(loaded);
    expect(doc.name).toBe("rt-pkg");
    expect(doc.version).toBe("3.1.4");
  });
});
