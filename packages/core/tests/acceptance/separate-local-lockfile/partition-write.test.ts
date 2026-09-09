/**
 * separate-local-lockfile — partition write / migrate / gitignore (acceptance RED).
 *
 * Specs: lockfile-local-shared-split, local-path-source, dependency-resolve.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadLockfile, resolveAndLock } from "@b-apm/core";
import {
  createFakePorts,
  createTempProject,
  gitignoreOf,
  initGitRepo,
  personalLockExists,
  PERSONAL_LOCK_FILE,
  readPersonalLockYaml,
  readSharedLockYaml,
  sharedLockExists,
  writePackageAt,
  writeRootWithApmDeps,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("separate-local-lockfile — partition write", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("discriminator local goes to personal lock, not shared", async () => {
    project = createTempProject();
    writePackageAt(project.cwd, ".agents/local", "local-pkg");
    writeRootWithApmDeps(project.cwd, "    - local: true\n");
    writeText(join(project.cwd, ".gitignore"), "node_modules/\n");

    await resolveAndLock({ cwd: project.cwd });

    expect(personalLockExists(project.cwd), "must create bapm.local.lock.yaml").toBe(true);
    const personal = readPersonalLockYaml(project.cwd);
    expect(personal).toMatch(/local-pkg|local:\.agents\/local|repo_url:\s*local:/i);

    expect(sharedLockExists(project.cwd)).toBe(true);
    const shared = readSharedLockYaml(project.cwd);
    expect(shared, "shared lock must not retain personal-scope pin").not.toMatch(/local-pkg/);
  });

  test("OpenAPM path: stays shared and does not create personal lock", async () => {
    project = createTempProject();
    writePackageAt(project.cwd, "pkgs/a", "pkg-a");
    writeRootWithApmDeps(project.cwd, "    - path: ./pkgs/a\n");

    await resolveAndLock({ cwd: project.cwd });

    expect(sharedLockExists(project.cwd)).toBe(true);
    const shared = loadLockfile({ cwd: project.cwd });
    expect(shared.document.dependencies?.some((d) => d.name === "pkg-a")).toBe(true);
    expect(personalLockExists(project.cwd), "path: must not require personal lock").toBe(false);
  });

  test("fresh dual-write: git → shared, local → personal", async () => {
    project = createTempProject();
    writePackageAt(project.cwd, ".agents/local", "local-pkg");
    writeRootWithApmDeps(
      project.cwd,
      [
        "    - local: true",
        "    - git: https://example.invalid/team/leaf-git.git",
        "      version: main",
      ].join("\n") + "\n",
    );
    writeText(join(project.cwd, ".gitignore"), "node_modules/\n");
    const ports = createFakePorts({
      commitsByRef: { main: "dddddddddddddddddddddddddddddddddddddddd" },
    });

    await resolveAndLock({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(existsSync(join(project.cwd, "bapm.lock.yaml"))).toBe(true);
    expect(personalLockExists(project.cwd)).toBe(true);

    const shared = readSharedLockYaml(project.cwd);
    expect(shared).toMatch(/leaf-git|example\.invalid\/team\/leaf-git/i);
    expect(shared).not.toMatch(/local-pkg/);

    const personal = readPersonalLockYaml(project.cwd);
    expect(personal).toMatch(/local-pkg|local:/i);
    expect(personal).not.toMatch(/leaf-git/);
  });

  test("empty personal scope does not create personal lock", async () => {
    project = createTempProject();
    writePackageAt(project.cwd, "pkgs/a", "pkg-a");
    writeRootWithApmDeps(project.cwd, "    - path: ./pkgs/a\n", "shared-only");

    await resolveAndLock({ cwd: project.cwd });

    expect(sharedLockExists(project.cwd)).toBe(true);
    expect(personalLockExists(project.cwd)).toBe(false);
  });

  test("top-level local_deployed bags stay on shared document", async () => {
    project = createTempProject();
    writePackageAt(project.cwd, "pkgs/a", "pkg-a");
    writeRootWithApmDeps(project.cwd, "    - path: ./pkgs/a\n", "bags-shared");
    writeText(
      join(project.cwd, "bapm.lock.yaml"),
      `lockfile_version: "1"
dependencies:
  - name: pkg-a
    repo_url: local:pkg-a
    source: local
    version: "0.0.1"
local_deployed_file_hashes:
  skills/x/SKILL.md: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
local_deployed_files:
  - skills/x/SKILL.md
`,
    );

    await resolveAndLock({ cwd: project.cwd });

    const shared = readSharedLockYaml(project.cwd);
    expect(shared).toMatch(/local_deployed_file_hashes/);
    expect(shared).toMatch(/skills\/x\/SKILL\.md/);
    if (personalLockExists(project.cwd)) {
      const personal = readPersonalLockYaml(project.cwd);
      expect(personal).not.toMatch(/local_deployed_file_hashes:/);
      expect(personal).not.toMatch(/local_deployed_files:/);
    }
  });

  test("stale personal entries cleared when local sources removed", async () => {
    project = createTempProject();
    writePackageAt(project.cwd, "pkgs/a", "pkg-a");
    writeRootWithApmDeps(project.cwd, "    - path: ./pkgs/a\n", "stale-clear");
    writeText(
      join(project.cwd, PERSONAL_LOCK_FILE),
      `lockfile_version: "1"
dependencies:
  - name: ghost-local
    repo_url: local:.agents/local
    source: local
    version: "0.0.1"
    x-bapm-lock-scope: local
`,
    );

    await resolveAndLock({ cwd: project.cwd });

    if (personalLockExists(project.cwd)) {
      const personal = readPersonalLockYaml(project.cwd);
      expect(personal).not.toMatch(/ghost-local/);
    } else {
      // Cleared by deleting the personal file — also acceptable.
      expect(personalLockExists(project.cwd)).toBe(false);
    }
  });

  test("next lock migrates local pins out of shared into personal", async () => {
    project = createTempProject();
    writePackageAt(project.cwd, ".agents/local", "legacy-local");
    writeRootWithApmDeps(project.cwd, "    - local: true\n", "legacy-migrate");
    writeText(join(project.cwd, ".gitignore"), "node_modules/\n.agents/local/\n");
    writeText(
      join(project.cwd, "bapm.lock.yaml"),
      `lockfile_version: "1"
dependencies:
  - name: legacy-local
    repo_url: local:.agents/local
    source: local
    version: "0.0.1"
    x-bapm-lock-scope: local
`,
    );

    await resolveAndLock({ cwd: project.cwd });

    expect(personalLockExists(project.cwd)).toBe(true);
    expect(readPersonalLockYaml(project.cwd)).toMatch(/legacy-local/);
    expect(readSharedLockYaml(project.cwd)).not.toMatch(/legacy-local/);
  });

  test("gitignore ensure covers bapm.local.lock.yaml when personal lock written", async () => {
    project = createTempProject();
    writePackageAt(project.cwd, ".agents/local", "local-pkg");
    writeRootWithApmDeps(project.cwd, "    - local: true\n");
    writeText(join(project.cwd, ".gitignore"), "node_modules/\n");
    initGitRepo(project.cwd, { extraAdd: [".gitignore"] });

    await resolveAndLock({ cwd: project.cwd });

    expect(personalLockExists(project.cwd)).toBe(true);
    const ignore = gitignoreOf(project.cwd);
    expect(ignore).toBeTruthy();
    expect(ignore!).toMatch(/bapm\.local\.lock\.yaml/);
  });
});
