/**
 * M6 core uninstall + prune acceptance — checklist C §9–13.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  expectRejectsMatching,
  getRunPrune,
  getRunUninstall,
  listFilesRecursive,
  loadLockDeps,
  modulesDir,
  nameOfDep,
  readLockBytes,
  readManifestText,
  sha256Hex,
  writeLock,
  writeManifest,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("M6 core uninstall + prune", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("§9 uninstall direct removes manifest, modules, deploy inventory, lock entry", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, "pkg-x"), { recursive: true });
    writeText(join(project.cwd, "pkg-x", "apm.yml"), `name: pkg-x\nversion: 0.0.1\ndependencies:\n  apm: []\n`);
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: uninstall-direct\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./pkg-x\n    - path: ./pkg-keep\n`,
    );
    mkdirSync(join(project.cwd, "pkg-keep"), { recursive: true });
    writeText(
      join(project.cwd, "pkg-keep", "apm.yml"),
      `name: pkg-keep\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );

    const harnessRel = ".agents/skills/from-x/SKILL.md";
    const harnessAbs = join(project.cwd, harnessRel);
    writeText(harnessAbs, "---\nname: from-x\n---\n# X\n");
    const hash = sha256Hex(readFileSync(harnessAbs));

    const mod = modulesDir(project.cwd);
    mkdirSync(join(mod, "pkg-x"), { recursive: true });
    writeText(join(mod, "pkg-x", "apm.yml"), `name: pkg-x\nversion: 0.0.1\ndependencies:\n  apm: []\n`);
    mkdirSync(join(mod, "pkg-keep"), { recursive: true });
    writeText(
      join(mod, "pkg-keep", "apm.yml"),
      `name: pkg-keep\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );

    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: local:pkg-x\n    name: pkg-x\n    source: local\n    path: pkg-x\n    deployed_file_hashes:\n      "${harnessRel}": "${hash}"\n  - repo_url: local:pkg-keep\n    name: pkg-keep\n    source: local\n    path: pkg-keep\n`,
    );

    await getRunUninstall()({
      cwd: project.cwd,
      packages: ["pkg-x"],
      names: ["pkg-x"],
    });

    const manifest = readManifestText(project.cwd);
    expect(manifest).not.toMatch(/pkg-x/);
    expect(manifest).toMatch(/pkg-keep/);
    expect(existsSync(join(mod, "pkg-x"))).toBe(false);
    expect(existsSync(join(mod, "pkg-keep"))).toBe(true);
    expect(existsSync(harnessAbs)).toBe(false);
    const deps = loadLockDeps(project.cwd);
    expect(deps.some((d) => nameOfDep(d).includes("pkg-x"))).toBe(false);
    expect(deps.some((d) => nameOfDep(d).includes("pkg-keep"))).toBe(true);
  });

  test("§10 uninstall unknown name fails", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: uninstall-unknown\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );
    writeLock(project.cwd, "bapm.lock.yaml", `lockfile_version: "1"\ndependencies: []\n`);

    await expectRejectsMatching(
      () =>
        getRunUninstall()({
          cwd: project.cwd,
          packages: ["not-installed-xyz"],
          names: ["not-installed-xyz"],
        }),
      /not.installed|unknown|not found|no such/i,
    );
  });

  test("§11 dry-run uninstall reports only; no mutation", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, "leaf"), { recursive: true });
    writeText(join(project.cwd, "leaf", "apm.yml"), `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`);
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: uninstall-dry\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
    );
    const mod = modulesDir(project.cwd);
    mkdirSync(join(mod, "leaf"), { recursive: true });
    writeText(join(mod, "leaf", "apm.yml"), `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`);
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n`,
    );
    const beforeManifest = readManifestText(project.cwd);
    const beforeLock = readLockBytes(project.cwd);
    const beforeMods = listFilesRecursive(mod);

    await getRunUninstall()({
      cwd: project.cwd,
      packages: ["leaf"],
      names: ["leaf"],
      dryRun: true,
      "dry-run": true,
    });

    expect(readManifestText(project.cwd)).toBe(beforeManifest);
    expect(Buffer.compare(readLockBytes(project.cwd), beforeLock)).toBe(0);
    expect(listFilesRecursive(mod)).toEqual(beforeMods);
  });

  test("§12 prune removes orphan modules; keeps declared", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, "kept"), { recursive: true });
    writeText(join(project.cwd, "kept", "apm.yml"), `name: kept\nversion: 0.0.1\ndependencies:\n  apm: []\n`);
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: prune-orphans\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./kept\n`,
    );
    const mod = modulesDir(project.cwd);
    mkdirSync(join(mod, "kept"), { recursive: true });
    writeText(join(mod, "kept", "apm.yml"), `name: kept\nversion: 0.0.1\ndependencies:\n  apm: []\n`);
    mkdirSync(join(mod, "orphan-extra"), { recursive: true });
    writeText(join(mod, "orphan-extra", "junk.txt"), "orphan\n");
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: local:kept\n    name: kept\n    source: local\n    path: kept\n`,
    );

    await getRunPrune()({ cwd: project.cwd });

    expect(existsSync(join(mod, "orphan-extra"))).toBe(false);
    expect(existsSync(join(mod, "kept"))).toBe(true);
  });

  test("§13 prune dry-run reports only", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: prune-dry\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );
    writeLock(project.cwd, "bapm.lock.yaml", `lockfile_version: "1"\ndependencies: []\n`);
    const mod = modulesDir(project.cwd);
    mkdirSync(join(mod, "orphan-dry"), { recursive: true });
    writeText(join(mod, "orphan-dry", "x.txt"), "x\n");
    const before = listFilesRecursive(mod);

    const result = await getRunPrune()({
      cwd: project.cwd,
      dryRun: true,
      "dry-run": true,
    });
    const blob = typeof result === "object" ? JSON.stringify(result) : String(result ?? "");
    expect(blob).toMatch(/orphan/i);
    expect(listFilesRecursive(mod)).toEqual(before);
    expect(existsSync(join(mod, "orphan-dry"))).toBe(true);
  });
});
