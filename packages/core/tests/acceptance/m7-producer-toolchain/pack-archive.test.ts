/**
 * M7 core — pack plain zip, schema fail, dry-run, sc-007 secrets (C §7–9, 18).
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  expectRejectsMatching,
  getRunPack,
  resolvePackArtifact,
  writeConformingManifest,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("M7 pack — plain zip archive", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("§7 pack --archive writes zip containing manifest at root", async () => {
    project = createTempProject();
    writeConformingManifest(project.cwd, { name: "pack-demo", version: "1.2.3" });
    writeText(join(project.cwd, ".apm", "note.txt"), "primitive\n");

    const runPack = getRunPack();
    const result = await runPack({
      cwd: project.cwd,
      archive: true,
      format: "zip",
    });

    const artifact = resolvePackArtifact(project.cwd, result);
    expect(artifact, "expected durable zip artifact").toBeTruthy();
    expect(existsSync(artifact!)).toBe(true);
    expect(artifact!.endsWith(".zip")).toBe(true);

    // Zip local header magic "PK\x03\x04" or empty-archive "PK\x05\x06"
    const magic = readFileSync(artifact!).subarray(0, 2).toString("utf8");
    expect(magic).toBe("PK");

    // Manifest must be discoverable inside archive bytes (stored/deflated name at root).
    const bytes = readFileSync(artifact!);
    const asLatin1 = bytes.toString("binary");
    expect(asLatin1.includes("bapm.yml") || asLatin1.includes("apm.yml")).toBe(true);
  });

  test("§8 pack fails on invalid manifest — no successful artifact", async () => {
    project = createTempProject();
    writeText(join(project.cwd, "bapm.yml"), "version: \"1.0.0\"\n"); // missing name

    const before = resolvePackArtifact(project.cwd);
    await expectRejectsMatching(
      () =>
        getRunPack()({
          cwd: project.cwd,
          archive: true,
        }),
      /name|validat|manifest|schema/i,
    );
    const after = resolvePackArtifact(project.cwd);
    // No new successful publish zip (allow none both before/after).
    if (after && after !== before) {
      throw new Error(`pack left artifact after schema fail: ${after}`);
    }
  });

  test("§18 dry-run leaves no durable archive", async () => {
    project = createTempProject();
    writeConformingManifest(project.cwd, { name: "dry-pack", version: "0.1.0" });

    await getRunPack()({
      cwd: project.cwd,
      archive: true,
      dryRun: true,
    });

    expect(resolvePackArtifact(project.cwd)).toBeUndefined();
  });

  test("manifest-only pack succeeds without lockfile", async () => {
    project = createTempProject();
    writeConformingManifest(project.cwd, { name: "nolock", version: "0.2.0" });

    const result = await getRunPack()({
      cwd: project.cwd,
      archive: true,
    });
    const artifact = resolvePackArtifact(project.cwd, result);
    expect(artifact).toBeTruthy();
    expect(existsSync(artifact!)).toBe(true);
  });
});

describe("M7 pack — sc-007 secret refuse", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("§9 pack refuses .env in pack set — fail closed", async () => {
    project = createTempProject();
    writeConformingManifest(project.cwd, { name: "secret-pack", version: "1.0.0" });
    writeText(join(project.cwd, ".env"), "SECRET=do-not-pack\n");

    await expectRejectsMatching(
      () =>
        getRunPack()({
          cwd: project.cwd,
          archive: true,
        }),
      /\.env|secret|sc-007|refus/i,
    );
    expect(resolvePackArtifact(project.cwd)).toBeUndefined();
  });

  test("pack refuses *.pem secret pattern", async () => {
    project = createTempProject();
    writeConformingManifest(project.cwd, { name: "pem-pack", version: "1.0.0" });
    writeText(join(project.cwd, "cert.pem"), "-----BEGIN CERTIFICATE-----\n");

    await expectRejectsMatching(
      () =>
        getRunPack()({
          cwd: project.cwd,
          archive: true,
        }),
      /\.pem|secret|sc-007|refus/i,
    );
    expect(resolvePackArtifact(project.cwd)).toBeUndefined();
  });
});
