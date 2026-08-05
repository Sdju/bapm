/**
 * p6a CLI: positional package refs vs zip; frozen×positional reject.
 * Spec: cli-runtime-surface, install-pipeline.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  expectKnownCommand,
  expectKnownFlags,
  fingerprintProject,
  parseInstallArgs,
  readManifestText,
  runInProject,
  writeLeafProject,
  type TempProject,
} from "./helpers.ts";

describe("CLI p6a positional package refs", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("parseInstallArgs treats non-zip positional as packageRefs", () => {
    const parsed = parseInstallArgs(["owner/repo"], { env: {} });
    expect(parsed.error).toBeUndefined();
    expect((parsed as { packageRefs?: string[] }).packageRefs).toEqual(["owner/repo"]);
    expect((parsed as { archivePath?: string }).archivePath).toBeUndefined();
  });

  test("positional package ref via CLI adds to dependencies.apm", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-pos-add");
    mkdirSync(join(project.cwd, "extra"), { recursive: true });
    writeFileSync(
      join(project.cwd, "extra", "apm.yml"),
      `name: extra\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );

    const { result, combined } = await runInProject(project.cwd, ["install", "./extra"]);

    expectKnownCommand(combined, "install");
    expectKnownFlags(combined);
    expect(result).toBe(0);
    expect(combined).not.toMatch(/Unknown install argument|expected options or a local \.zip/i);
    expect(readManifestText(project.cwd)).toMatch(/\.\/extra|path:\s*\.\/extra/);
  });

  test("frozen positional rejected at CLI without mutation", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-frozen-pos");
    const seed = await runInProject(project.cwd, ["install"]);
    expect(seed.result).toBe(0);
    const before = fingerprintProject(project.cwd);
    const manifestBefore = readManifestText(project.cwd);

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--frozen",
      "owner/repo",
    ]);

    expectKnownCommand(combined, "install");
    expect(result).not.toBe(0);
    // Must be frozen×positional — not the legacy "unknown / expected .zip" path.
    expect(combined).toMatch(/frozen|positional|package.?ref|mutat/i);
    expect(combined).not.toMatch(/Unknown install argument \(expected options or a local \.zip\)/i);
    expect(fingerprintProject(project.cwd)).toBe(before);
    expect(readManifestText(project.cwd)).toBe(manifestBefore);
  });

  test("positional zip still uses archive semantics (corrupt zip fails closed)", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-zip");
    const zip = join(project.cwd, "bogus.zip");
    writeFileSync(zip, "not-a-pack", "utf8");
    const manifestBefore = readManifestText(project.cwd);

    const { result, combined } = await runInProject(project.cwd, ["install", zip]);

    expectKnownCommand(combined, "install");
    expect(result).not.toBe(0);
    expect(readManifestText(project.cwd)).toBe(manifestBefore);
    expect(readManifestText(project.cwd)).not.toMatch(/bogus\.zip/);
  });
});
