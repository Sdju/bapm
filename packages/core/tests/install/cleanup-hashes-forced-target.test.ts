/**
 * Forced target activation, orphan cleanup, deployed_file_hashes / lk-017 lite.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  createFakePorts,
  createTempProject,
  expectRejectsMatching,
  getCreateRegistry,
  getRegisterTarget,
  getRunInstall,
  importTargetApi,
  modulesDir,
  readLockBytes,
  writeLock,
  writeManifest,
  writeText,
  type TempProject,
} from "./helpers.ts";

function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

describe("core install — forced target / cleanup / hashes", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("forcedTarget cursor materializes without .cursor/ detect signal", async () => {
    project = createTempProject();
    const ports = createFakePorts();
    mkdirSync(join(project.cwd, "skill-dep"), { recursive: true });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: force-cursor\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./skill-dep\n`,
    );
    writeFileSync(
      join(project.cwd, "skill-dep", "apm.yml"),
      `name: skill-dep\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    writeText(
      join(project.cwd, "skill-dep", ".apm", "skills", "hello", "SKILL.md"),
      "---\nname: hello\n---\n# Hello\n",
    );
    // No .cursor/ and no .cursorrules

    const api = await importTargetApi();
    const registry = getCreateRegistry(api)();
    const register = getRegisterTarget(api, registry);
    let materializeCalls = 0;
    register({
      id: "cursor",
      deployRoots: [".agents/skills", ".cursor"],
      detect: () => false,
      materialize: async () => {
        materializeCalls += 1;
        mkdirSync(join(project.cwd, ".agents", "skills", "hello"), { recursive: true });
        writeFileSync(
          join(project.cwd, ".agents", "skills", "hello", "SKILL.md"),
          "---\nname: hello\n---\n# Hello\n",
          "utf8",
        );
      },
    });

    const runInstall = getRunInstall();
    await runInstall({
      cwd: project.cwd,
      frozen: false,
      forcedTarget: "cursor",
      forceTarget: "cursor",
      targetRegistry: registry,
      registry,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(materializeCalls).toBe(1);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(true);
  });

  test("unknown forcedTarget id is rejected without harness writes", async () => {
    project = createTempProject();
    const ports = createFakePorts();
    mkdirSync(join(project.cwd, "leaf"), { recursive: true });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: bad-force\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
    );
    writeFileSync(
      join(project.cwd, "leaf", "apm.yml"),
      `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );

    const api = await importTargetApi();
    const registry = getCreateRegistry(api)();
    const register = getRegisterTarget(api, registry);
    register({
      id: "cursor",
      deployRoots: [".agents/skills", ".cursor"],
      detect: () => false,
      materialize: async () => {
        throw new Error("must not materialize");
      },
    });

    const runInstall = getRunInstall();
    await expectRejectsMatching(
      () =>
        runInstall({
          cwd: project.cwd,
          frozen: false,
          forcedTarget: "not-a-host",
          forceTarget: "not-a-host",
          targetRegistry: registry,
          registry,
          gitRemote: ports.gitRemote,
          tagLister: ports.tagLister,
          downloader: ports.downloader,
        }),
      /not-a-host|unknown.*target|unregistered/i,
    );

    expect(existsSync(join(project.cwd, ".agents", "skills"))).toBe(false);
  });

  test("without force and without detect — rejects before harness writes", async () => {
    project = createTempProject();
    const ports = createFakePorts();
    mkdirSync(join(project.cwd, "leaf"), { recursive: true });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: no-detect\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
    );
    writeFileSync(
      join(project.cwd, "leaf", "apm.yml"),
      `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    writeText(
      join(project.cwd, "leaf", ".apm", "skills", "x", "SKILL.md"),
      "---\nname: x\n---\n# X\n",
    );

    const api = await importTargetApi();
    const registry = getCreateRegistry(api)();
    const register = getRegisterTarget(api, registry);
    register({
      id: "cursor",
      deployRoots: [".agents/skills", ".cursor"],
      detect: () => false,
      materialize: async () => {
        mkdirSync(join(project.cwd, ".agents", "skills", "x"), { recursive: true });
        writeFileSync(join(project.cwd, ".agents", "skills", "x", "SKILL.md"), "oops\n", "utf8");
      },
    });

    const runInstall = getRunInstall();
    await expect(
      runInstall({
        cwd: project.cwd,
        frozen: false,
        targetRegistry: registry,
        registry,
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
        downloader: ports.downloader,
      }),
    ).rejects.toThrow(/--target\s+<id>/i);

    expect(existsSync(modulesDir(project.cwd))).toBe(true);
    expect(existsSync(join(project.cwd, ".agents", "skills", "x", "SKILL.md"))).toBe(false);
    expect(existsSync(join(project.cwd, ".cursor"))).toBe(false);
  });

  test("orphan cleanup removes recorded harness files for dropped dependency", async () => {
    project = createTempProject();
    const ports = createFakePorts();
    mkdirSync(join(project.cwd, "keep-dep"), { recursive: true });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: orphan\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./keep-dep\n`,
    );
    writeFileSync(
      join(project.cwd, "keep-dep", "apm.yml"),
      `name: keep-dep\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );

    const orphanRel = ".agents/skills/gone/SKILL.md";
    const orphanAbs = join(project.cwd, orphanRel);
    mkdirSync(join(project.cwd, ".agents", "skills", "gone"), { recursive: true });
    writeFileSync(orphanAbs, "---\nname: gone\n---\n# Gone\n", "utf8");
    const keepUser = join(project.cwd, "NOTES.md");
    writeFileSync(keepUser, "user file\n", "utf8");

    const goneHash = sha256(readFileSync(orphanAbs));
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: local:gone-dep\n    name: gone-dep\n    source: local\n    path: ./gone-dep\n    deployed_file_hashes:\n      "${orphanRel}": "${goneHash}"\n  - repo_url: local:keep-dep\n    name: keep-dep\n    source: local\n    path: ./keep-dep\n`,
    );

    const api = await importTargetApi();
    const registry = getCreateRegistry(api)();
    const register = getRegisterTarget(api, registry);
    register({
      id: "cursor",
      deployRoots: [".agents/skills", ".cursor"],
      detect: () => true,
      materialize: async () => {},
    });
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });

    const runInstall = getRunInstall();
    await runInstall({
      cwd: project.cwd,
      frozen: false,
      targetRegistry: registry,
      registry,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(existsSync(orphanAbs)).toBe(false);
    expect(existsSync(keepUser)).toBe(true);
  });

  test("non-frozen install writes deployed_file_hashes after materialize", async () => {
    project = createTempProject();
    const ports = createFakePorts();
    mkdirSync(join(project.cwd, "skill-dep"), { recursive: true });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: hash-write\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm:\n    - path: ./skill-dep\n`,
    );
    writeFileSync(
      join(project.cwd, "skill-dep", "apm.yml"),
      `name: skill-dep\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    writeText(
      join(project.cwd, "skill-dep", ".apm", "skills", "hello", "SKILL.md"),
      "---\nname: hello\n---\n# Hello\n",
    );
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });

    const api = await importTargetApi();
    const registry = getCreateRegistry(api)();
    const register = getRegisterTarget(api, registry);
    const deployedRel = ".agents/skills/hello/SKILL.md";
    register({
      id: "cursor",
      deployRoots: [".agents/skills", ".cursor"],
      detect: () => true,
      materialize: async () => {
        mkdirSync(join(project.cwd, ".agents", "skills", "hello"), { recursive: true });
        writeFileSync(join(project.cwd, deployedRel), "---\nname: hello\n---\n# Hello\n", "utf8");
        return {
          targetId: "cursor",
          deployedFiles: [{ path: deployedRel }],
        };
      },
    });

    const runInstall = getRunInstall();
    await runInstall({
      cwd: project.cwd,
      frozen: false,
      targetRegistry: registry,
      registry,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    const lockText = readLockBytes(project.cwd).toString("utf8");
    expect(lockText).toMatch(/deployed_file_hashes/);
    expect(lockText).toMatch(/\.agents\/skills\/hello\/SKILL\.md/);
  });

  test("frozen re-verifies deployed_file_hashes — tampered file fails (lk-017 lite)", async () => {
    project = createTempProject();
    const ports = createFakePorts();
    mkdirSync(join(project.cwd, "leaf"), { recursive: true });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: hash-verify\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
    );
    writeFileSync(
      join(project.cwd, "leaf", "apm.yml"),
      `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );

    const harnessRel = ".agents/skills/hello/SKILL.md";
    mkdirSync(join(project.cwd, ".agents", "skills", "hello"), { recursive: true });
    const original = "---\nname: hello\n---\n# Original\n";
    writeFileSync(join(project.cwd, harnessRel), original, "utf8");
    const goodHash = sha256(original);

    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: ./leaf\n    deployed_file_hashes:\n      "${harnessRel}": "${goodHash}"\n`,
    );

    // Tamper after lock recorded
    writeFileSync(join(project.cwd, harnessRel), "---\nname: hello\n---\n# TAMPERED\n", "utf8");
    const before = readLockBytes(project.cwd);

    const api = await importTargetApi();
    const registry = getCreateRegistry(api)();
    const register = getRegisterTarget(api, registry);
    register({
      id: "cursor",
      deployRoots: [".agents/skills", ".cursor"],
      detect: () => true,
      materialize: async () => {},
    });
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });

    const runInstall = getRunInstall();
    await expectRejectsMatching(
      () =>
        runInstall({
          cwd: project.cwd,
          frozen: true,
          targetRegistry: registry,
          registry,
          gitRemote: ports.gitRemote,
          tagLister: ports.tagLister,
          downloader: ports.downloader,
        }),
      /hash|deployed|tamper|mismatch|integrity/i,
    );

    expect(Buffer.compare(readLockBytes(project.cwd), before)).toBe(0);
  });
});
