/**
 * Pack zip membership with project-root `.bapmignore`.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { unzipSync } from "fflate";
import {
  createTempProject,
  getRunPack,
  resolvePackArtifact,
  writeConformingManifest,
  writeText,
  type TempProject,
} from "./helpers.ts";

function listZipPaths(bytes: Uint8Array): string[] {
  return Object.keys(unzipSync(bytes)).map((p) => p.replace(/\\/g, "/"));
}

describe("pack — .bapmignore membership", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("omits CHANGELOG.md and docs/**; keeps manifest and README", async () => {
    project = createTempProject();
    writeConformingManifest(project.cwd, { name: "ignore-docs", version: "2.0.0" });
    writeText(join(project.cwd, ".bapmignore"), "CHANGELOG.md\ndocs/**\n");
    writeText(join(project.cwd, "CHANGELOG.md"), "## 2.0.0\n");
    writeText(join(project.cwd, "docs", "guide.md"), "# guide\n");
    writeText(join(project.cwd, "README.md"), "# keep\n");
    writeText(join(project.cwd, ".apm", "note.txt"), "ok\n");

    const result = await getRunPack()({
      cwd: project.cwd,
      archive: true,
      format: "zip",
    });
    const artifact = resolvePackArtifact(project.cwd, result);
    expect(artifact).toBeTruthy();
    const paths = listZipPaths(new Uint8Array(readFileSync(artifact!)));

    expect(paths.includes("CHANGELOG.md")).toBe(false);
    expect(paths.some((p) => p === "docs" || p.startsWith("docs/"))).toBe(false);
    expect(paths.includes("README.md")).toBe(true);
    expect(paths.includes("bapm.yml")).toBe(true);
    expect(paths.includes(".bapmignore")).toBe(false);
  });

  test("ignored .env succeeds without secret-refuse", async () => {
    project = createTempProject();
    writeConformingManifest(project.cwd, { name: "ignore-env", version: "1.0.0" });
    writeText(join(project.cwd, ".bapmignore"), ".env\n");
    writeText(join(project.cwd, ".env"), "SECRET=x\n");
    writeText(join(project.cwd, ".apm", "note.txt"), "ok\n");

    const result = await getRunPack()({
      cwd: project.cwd,
      archive: true,
      format: "zip",
    });
    const artifact = resolvePackArtifact(project.cwd, result);
    expect(artifact).toBeTruthy();
    const paths = listZipPaths(new Uint8Array(readFileSync(artifact!)));
    expect(paths.includes(".env")).toBe(false);
  });
});
