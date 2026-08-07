/**
 * Positional package-ref add, auto-create, frozen×positional, dry-run preview.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createFakePorts,
  createTempProject,
  fingerprintProject,
  getCreateRegistry,
  getRegisterTarget,
  getRunInstall,
  importTargetApi,
  installWithSpy,
  manifestExists,
  readManifestText,
  writeLeafProject,
  type TempProject,
} from "./ux-helpers.ts";

describe("install positional package-ref add", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("non-zip package ref adds to dependencies.apm and install proceeds", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "pos-add");
    mkdirSync(join(project.cwd, "extra"), { recursive: true });
    writeFileSync(
      join(project.cwd, "extra", "apm.yml"),
      `name: extra\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );

    const { result } = await installWithSpy(project.cwd, {
      packageRefs: ["./extra"],
      dryRun: false,
    });

    expect(result).toMatchObject({ ok: true });
    const manifest = readManifestText(project.cwd);
    expect(manifest).toMatch(/dependencies:[\s\S]*apm:[\s\S]*\.\/extra|path:\s*\.\/extra/);
  });

  test("missing manifest with positional creates then adds", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, "extra"), { recursive: true });
    writeFileSync(
      join(project.cwd, "extra", "apm.yml"),
      `name: extra\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    expect(manifestExists(project.cwd)).toBe(false);

    const { result } = await installWithSpy(project.cwd, {
      packageRefs: ["./extra"],
      dryRun: false,
    });

    expect(result).toMatchObject({ ok: true });
    expect(manifestExists(project.cwd)).toBe(true);
    expect(readManifestText(project.cwd)).toMatch(/\.\/extra|path:\s*\.\/extra/);
  });

  test("bare install without manifest does not auto-create", async () => {
    project = createTempProject();
    expect(manifestExists(project.cwd)).toBe(false);

    const runInstall = getRunInstall();
    const ports = createFakePorts();
    await expect(
      runInstall({
        cwd: project.cwd,
        frozen: false,
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
        downloader: ports.downloader,
      }),
    ).rejects.toThrow(/manifest|apm\.yml|bapm\.yml|not found|missing/i);

    expect(manifestExists(project.cwd)).toBe(false);
  });

  test("missing manifest takes precedence over an invalid target selection", async () => {
    project = createTempProject();
    const runInstall = getRunInstall();
    const ports = createFakePorts();

    await expect(
      runInstall({
        cwd: project.cwd,
        forcedTarget: "not-a-host",
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
        downloader: ports.downloader,
      }),
    ).rejects.toThrow(/manifest|apm\.yml|bapm\.yml|not found|missing/i);

    expect(manifestExists(project.cwd)).toBe(false);
  });

  test("frozen plus positional rejected without mutation", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "frozen-pos");
    const seeded = await installWithSpy(project.cwd, {});
    expect(seeded.result).toMatchObject({ ok: true });
    const before = fingerprintProject(project.cwd);
    const manifestBefore = readManifestText(project.cwd);

    const runInstall = getRunInstall();
    const ports = createFakePorts();
    const api = await importTargetApi();
    const registry = getCreateRegistry(api)();
    getRegisterTarget(api, registry)({
      id: "cursor",
      deployRoots: [".agents/skills", ".cursor"],
      detect: () => true,
      materialize: async () => ({ deployedFiles: [] }),
    });

    await expect(
      runInstall({
        cwd: project.cwd,
        frozen: true,
        packageRefs: ["./extra"],
        forcedTarget: "not-a-host",
        targetRegistry: registry,
        registry,
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
        downloader: ports.downloader,
      }),
    ).rejects.toThrow(/frozen|positional|package.?ref|mutat/i);

    expect(fingerprintProject(project.cwd)).toBe(before);
    expect(readManifestText(project.cwd)).toBe(manifestBefore);
  });

  test("dry-run positional previews without writing manifest", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "dry-pos");
    const before = fingerprintProject(project.cwd);
    const manifestBefore = readManifestText(project.cwd);

    const { result } = await installWithSpy(project.cwd, {
      dryRun: true,
      packageRefs: ["./extra"],
    });

    expect(result).toMatchObject({ ok: true });
    expect(readManifestText(project.cwd)).toBe(manifestBefore);
    expect(fingerprintProject(project.cwd)).toBe(before);
    const preview = JSON.stringify(result);
    expect(preview).toMatch(/extra|would|add|preview|dry.?run/i);
  });

  test("zip archivePath is not treated as package-ref add", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "zip-not-ref");
    const bogusZip = join(project.cwd, "pack.zip");
    writeFileSync(bogusZip, "not-a-real-zip", "utf8");
    const manifestBefore = readManifestText(project.cwd);

    const runInstall = getRunInstall();
    const ports = createFakePorts();
    await expect(
      runInstall({
        cwd: project.cwd,
        archivePath: bogusZip,
        frozen: false,
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
        downloader: ports.downloader,
      }),
    ).rejects.toThrow();

    // Must not have rewritten deps as if pack.zip were a package ref string.
    expect(readManifestText(project.cwd)).toBe(manifestBefore);
    expect(readManifestText(project.cwd)).not.toMatch(/pack\.zip/);
  });
});
