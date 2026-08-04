/**
 * M4 checklist C §1–4 — install pipeline: modules + lock, no hard cursor dep,
 * integrate without registered target.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { APM_MODULES_DIR, loadLockfile } from "@bapm/core";
import {
  createFakePorts,
  createTempProject,
  depsOf,
  existingLockPath,
  getRunInstall,
  hasHarnessWrites,
  listFilesRecursive,
  lockOf,
  modulesDir,
  readCorePackageJson,
  writeLock,
  writeManifest,
  writeText,
  type TempProject,
} from "./helpers.ts";

const COMMIT = "ffffffffffffffffffffffffffffffffffffffff";

describe("M4 install pipeline — modules + lock (§1–4)", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("warm install places modules under apm_modules; lock write-back dual-read (§1)", async () => {
    project = createTempProject();
    const ports = createFakePorts({ commitsByRef: { main: COMMIT } });
    writeManifest(
      project.cwd,
      "apm.yml",
      `name: warm-install\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/one.git\n      ref: main\n`,
    );
    writeLock(
      project.cwd,
      "apm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/one\n    resolved_commit: "${COMMIT}"\n`,
    );

    const runInstall = getRunInstall();
    await runInstall({
      cwd: project.cwd,
      frozen: false,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(existsSync(modulesDir(project.cwd))).toBe(true);
    expect(APM_MODULES_DIR).toBe("apm_modules");
    expect(existsSync(join(project.cwd, "apm.lock.yaml"))).toBe(true);
    expect(existsSync(join(project.cwd, "bapm.lock.yaml"))).toBe(false);
    const deps = depsOf(lockOf(loadLockfile({ cwd: project.cwd })));
    expect(deps.length).toBeGreaterThanOrEqual(1);
  });

  test("fresh install writes lock + modules from manifest only (§2)", async () => {
    project = createTempProject();
    const ports = createFakePorts({ commitsByRef: { main: COMMIT } });
    mkdirSync(join(project.cwd, "leaf"), { recursive: true });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: fresh-install\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
    );
    writeFileSync(
      join(project.cwd, "leaf", "apm.yml"),
      `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );

    const runInstall = getRunInstall();
    await runInstall({
      cwd: project.cwd,
      frozen: false,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(existsSync(modulesDir(project.cwd))).toBe(true);
    expect(existingLockPath(project.cwd)).toBeTruthy();
    expect(listFilesRecursive(modulesDir(project.cwd)).length).toBeGreaterThan(0);
  });

  test("core package graph: depends on bapm-target-api, not bapm-target-cursor (§3)", () => {
    const pkg = readCorePackageJson();
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(deps["bapm-target-cursor"]).toBeUndefined();
    for (const key of Object.keys(deps)) {
      if (key.startsWith("bapm-target-") && key !== "bapm-target-api") {
        expect.fail(`core must not hard-depend on concrete target ${key}`);
      }
    }
    expect(deps["bapm-target-api"]).toBeTruthy();
  });

  test("integrate without registered target: modules+lock OK, no harness writes (§4)", async () => {
    project = createTempProject();
    const ports = createFakePorts();
    mkdirSync(join(project.cwd, "leaf"), { recursive: true });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: no-target\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
    );
    writeFileSync(
      join(project.cwd, "leaf", "apm.yml"),
      `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    writeText(
      join(project.cwd, "leaf", ".apm", "skills", "from-dep", "SKILL.md"),
      "---\nname: from-dep\n---\n# From dep\n",
    );
    mkdirSync(join(project.cwd, ".agents"), { recursive: true });
    writeFileSync(join(project.cwd, ".agents", "keep.txt"), "keep\n", "utf8");
    const beforeAgents = listFilesRecursive(join(project.cwd, ".agents"));

    const runInstall = getRunInstall();
    await runInstall({
      cwd: project.cwd,
      frozen: false,
      // empty / omitted registry → no registered targets
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(existsSync(modulesDir(project.cwd))).toBe(true);
    expect(existingLockPath(project.cwd)).toBeTruthy();
    expect(listFilesRecursive(join(project.cwd, ".agents"))).toEqual(beforeAgents);
    expect(
      hasHarnessWrites(project.cwd, [".agents", ".cursor", ".github/instructions"]),
    ).toBe(false);
  });
});
