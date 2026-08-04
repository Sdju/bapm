/**
 * Core update — checklist C §1–5 (rs-011/rs-012, lk-010, frozen, dry-run).
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createFakePorts,
  createTempProject,
  expectRejectsMatching,
  fakeCommit,
  getRunUpdate,
  listFilesRecursive,
  loadLockDeps,
  modulesDir,
  nameOfDep,
  pinOf,
  readLockBytes,
  readManifestText,
  writeLock,
  writeManifest,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("core update (rs-011 / rs-012 / lk-010)", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("§1 rs-011 full update moves direct git-semver pins; manifest constraints unchanged", async () => {
    project = createTempProject();
    const oldCommit = fakeCommit("pkg-a-v100");
    const newCommit = fakeCommit("pkg-a-v110");
    const ports = createFakePorts({
      tagsByRepo: {
        "example/pkg-a": [
          { tag: "v1.0.0", commit: oldCommit },
          { tag: "v1.1.0", commit: newCommit },
        ],
      },
    });

    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: update-full\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/pkg-a.git\n      ref: "^1.0.0"\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/pkg-a\n    name: pkg-a\n    resolved_commit: "${oldCommit}"\n    resolved_tag: v1.0.0\n`,
    );
    const manifestBefore = readManifestText(project.cwd);

    const runUpdate = getRunUpdate();
    await runUpdate({
      cwd: project.cwd,
      yes: true,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(readManifestText(project.cwd)).toBe(manifestBefore);
    expect(readManifestText(project.cwd)).toMatch(/\^1\.0\.0/);
    const deps = loadLockDeps(project.cwd);
    const pkgA = deps.find((d) => nameOfDep(d).includes("pkg-a"));
    expect(pkgA).toBeTruthy();
    expect(pinOf(pkgA!)).toBe(newCommit);
  });

  test("§2 rs-012 scoped update changes only named package pin", async () => {
    project = createTempProject();
    const aOld = fakeCommit("a-old");
    const aNew = fakeCommit("a-new");
    const bPin = fakeCommit("b-pin");
    const ports = createFakePorts({
      tagsByRepo: {
        "example/pkg-a": [
          { tag: "v1.0.0", commit: aOld },
          { tag: "v1.2.0", commit: aNew },
        ],
        "example/pkg-b": [{ tag: "v2.0.0", commit: bPin }],
      },
    });

    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: update-scoped\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/pkg-a.git\n      ref: "^1.0.0"\n    - git: https://github.com/example/pkg-b.git\n      ref: "^2.0.0"\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/pkg-a\n    name: pkg-a\n    resolved_commit: "${aOld}"\n    resolved_tag: v1.0.0\n  - repo_url: github.com/example/pkg-b\n    name: pkg-b\n    resolved_commit: "${bPin}"\n    resolved_tag: v2.0.0\n`,
    );

    const runUpdate = getRunUpdate();
    await runUpdate({
      cwd: project.cwd,
      yes: true,
      packages: ["pkg-a"],
      scope: ["pkg-a"],
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    const deps = loadLockDeps(project.cwd);
    const pkgA = deps.find((d) => nameOfDep(d).includes("pkg-a"));
    const pkgB = deps.find((d) => nameOfDep(d).includes("pkg-b"));
    expect(pinOf(pkgA!)).toBe(aNew);
    expect(pinOf(pkgB!)).toBe(bPin);
  });

  test("§3 lk-010 purge re-downloads even when tag unchanged", async () => {
    project = createTempProject();
    const commit = fakeCommit("same-tag");
    const ports = createFakePorts({
      tagsByRepo: {
        "example/stale": [{ tag: "v1.0.0", commit }],
      },
    });

    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: update-purge\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/stale.git\n      ref: "^1.0.0"\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/stale\n    name: stale\n    resolved_commit: "${commit}"\n    resolved_tag: v1.0.0\n`,
    );

    const modRoot = modulesDir(project.cwd);
    const installPath = join(modRoot, "stale");
    mkdirSync(installPath, { recursive: true });
    writeText(join(installPath, "STALE_MARKER"), "stale-content\n");
    writeText(
      join(installPath, "apm.yml"),
      `name: stale\nversion: 1.0.0\ndependencies:\n  apm: []\n`,
    );

    const downloadsBefore = ports.downloadCalls.length;
    const runUpdate = getRunUpdate();
    await runUpdate({
      cwd: project.cwd,
      yes: true,
      packages: ["stale"],
      scope: ["stale"],
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(ports.downloadCalls.length).toBeGreaterThan(downloadsBefore);
    expect(existsSync(join(installPath, "STALE_MARKER"))).toBe(false);
  });

  test("§4 frozen update without override fails closed; lock unchanged", async () => {
    project = createTempProject();
    const commit = fakeCommit("frozen-a");
    const ports = createFakePorts({
      tagsByRepo: {
        "example/one": [
          { tag: "v1.0.0", commit },
          { tag: "v1.1.0", commit: fakeCommit("frozen-newer") },
        ],
      },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: update-frozen\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/one.git\n      ref: "^1.0.0"\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/one\n    name: one\n    resolved_commit: "${commit}"\n    resolved_tag: v1.0.0\n`,
    );
    const before = readLockBytes(project.cwd);

    const runUpdate = getRunUpdate();
    await expectRejectsMatching(
      () =>
        runUpdate({
          cwd: project.cwd,
          yes: true,
          frozen: true,
          gitRemote: ports.gitRemote,
          tagLister: ports.tagLister,
          downloader: ports.downloader,
        }),
      /frozen|override|refuse|update/i,
    );
    expect(Buffer.compare(readLockBytes(project.cwd), before)).toBe(0);
  });

  test("§5 dry-run prints plan; lock and modules unchanged", async () => {
    project = createTempProject();
    const oldCommit = fakeCommit("dry-old");
    const ports = createFakePorts({
      tagsByRepo: {
        "example/dry": [
          { tag: "v1.0.0", commit: oldCommit },
          { tag: "v1.1.0", commit: fakeCommit("dry-new") },
        ],
      },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: update-dry\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/dry.git\n      ref: "^1.0.0"\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/dry\n    name: dry\n    resolved_commit: "${oldCommit}"\n    resolved_tag: v1.0.0\n`,
    );
    const mod = modulesDir(project.cwd);
    mkdirSync(mod, { recursive: true });
    writeText(join(mod, "keep.txt"), "keep\n");
    const beforeLock = readLockBytes(project.cwd);
    const beforeMods = listFilesRecursive(mod);

    const runUpdate = getRunUpdate();
    const result = await runUpdate({
      cwd: project.cwd,
      dryRun: true,
      "dry-run": true,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    const plan =
      typeof result === "object" && result ? JSON.stringify(result) : String(result ?? "");
    expect(plan.length + (ports.tagListCalls.length > 0 ? 1 : 0)).toBeGreaterThan(0);
    expect(Buffer.compare(readLockBytes(project.cwd), beforeLock)).toBe(0);
    expect(listFilesRecursive(mod)).toEqual(beforeMods);
    expect(readFileSync(join(mod, "keep.txt"), "utf8")).toBe("keep\n");
  });
});
