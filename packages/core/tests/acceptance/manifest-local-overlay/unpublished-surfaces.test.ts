/**
 * Pack / publish must omit bapm.local.yml (unpublished personal overlay).
 * Publish wire `apm.yml` MUST be dual-read base only (no overlay field leak).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import { unzipSync } from "fflate";
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

function zipMemberText(bytes: Uint8Array, memberName: string): string {
  const entries = unzipSync(bytes);
  const key =
    entries[memberName] !== undefined
      ? memberName
      : Object.keys(entries).find((k) => k === memberName || k.endsWith(`/${memberName}`));
  if (!key || entries[key] === undefined) {
    throw new Error(`zip missing member ${memberName}; got: ${Object.keys(entries).join(", ")}`);
  }
  return new TextDecoder().decode(entries[key]);
}

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

  test("publish archive omits bapm.local.yml and wire apm.yml is base-only", async () => {
    project = createTempProject();
    writeBaseManifest(
      project.cwd,
      conformingBase({
        name: "example/pub-omit",
        version: "2.0.0",
        // base has no env / active — overlay-only markers must not appear in wire
      }),
    );
    writeLocalOverlay(
      project.cwd,
      [
        "active:",
        "  - cursor",
        "env:",
        '  OVERLAY_ONLY_SECRET: "must-not-leak"',
        "registries:",
        "  overlay-reg:",
        '    url: "https://example.invalid/overlay-reg"',
      ].join("\n") + "\n",
    );
    writeText(join(project.cwd, ".apm", "instructions.md"), "# hello\n");

    const result = await getBuildPublishArchive()({
      cwd: project.cwd,
      dryRun: true,
    });
    const bytes = resolveArchiveBytes(project.cwd, result);
    const paths = listZipPaths(bytes);
    expect(
      paths.some((p) => p === "bapm.local.yml" || p.endsWith("/bapm.local.yml")),
      `publish zip must not include bapm.local.yml; got: ${paths.join(", ")}`,
    ).toBe(false);

    const wire = zipMemberText(bytes, "apm.yml");
    expect(wire).toMatch(/name:\s*example\/pub-omit/);
    expect(wire).toMatch(/2\.0\.0/);
    // Overlay-only fields must not leak into OpenAPM wire apm.yml
    expect(wire, "wire must not contain overlay env key").not.toMatch(/OVERLAY_ONLY_SECRET/);
    expect(wire, "wire must not contain overlay active").not.toMatch(/\bactive\b/);
    expect(wire, "wire must not contain overlay registries").not.toMatch(/overlay-reg/);
    expect(wire, "wire must not mention personal overlay filename").not.toMatch(/bapm\.local\.yml/);
  });
});
