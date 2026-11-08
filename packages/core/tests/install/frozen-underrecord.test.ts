/**
 * P1 #5 — frozen must not deploy primitives the lock does not record, and
 * local package snapshots (content_hash) must be re-verified.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { computeCanonicalTreeSha256 } from "@b-apm/core";
import {
  createFakePorts,
  createTempProject,
  expectRejectsMatching,
  getCreateIntegrationRegistry,
  getRegisterIntegration,
  getRunInstall,
  importIntegrationApi,
  listFilesRecursive,
  modulesDir,
  readLockBytes,
  writeLock,
  writeManifest,
  writeText,
  type TempProject,
} from "./helpers.ts";

const COMMIT = "cccccccccccccccccccccccccccccccccccccccc";
const DEPLOYED_REL = ".agents/skills/hello/SKILL.md";
const DEPLOYED_CONTENT = "---\nname: hello\n---\n# Hello\n";
const SKILL_CONTENT = "---\nname: hello\n---\n# Leaf hello\n";

describe("frozen under-record gate (P1 #5)", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  function writeLeafPackage(options?: { skill?: string }): string {
    writeText(
      join(project.cwd, "leaf", "apm.yml"),
      `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );
    writeText(
      join(project.cwd, "leaf", ".apm", "skills", "hello", "SKILL.md"),
      options?.skill ?? SKILL_CONTENT,
    );
    return computeCanonicalTreeSha256(join(project.cwd, "leaf"));
  }

  function writeConsumerManifest(): void {
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: frozen-under-record\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
    );
  }

  function writeLocalLock(options: { contentHash?: string; deployedHashes?: boolean }): void {
    const lines = [
      `lockfile_version: "1"`,
      `dependencies:`,
      `  - repo_url: local:leaf`,
      `    name: leaf`,
      `    source: local`,
      `    path: leaf`,
    ];
    if (options.contentHash) lines.push(`    content_hash: "${options.contentHash}"`);
    if (options.deployedHashes !== false) {
      lines.push(`    deployed_file_hashes:`);
      lines.push(`      ${DEPLOYED_REL}: "${sha256(DEPLOYED_CONTENT)}"`);
      lines.push(`    deployed_files:`);
      lines.push(`      - ${DEPLOYED_REL}`);
    }
    writeLock(project.cwd, "bapm.lock.yaml", `${lines.join("\n")}\n`);
  }

  function writeDeployedHarnessFile(): void {
    mkdirSync(join(project.cwd, ".agents", "skills", "hello"), { recursive: true });
    writeFileSync(join(project.cwd, DEPLOYED_REL), DEPLOYED_CONTENT, "utf8");
    writeFileSync(join(project.cwd, ".agents", "keep.txt"), "keep\n", "utf8");
  }

  async function runFrozen(): Promise<unknown> {
    const ports = createFakePorts();
    return getRunInstall()({
      cwd: project.cwd,
      frozen: true,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });
  }

  test("lock row without deployed_file_hashes fails before any writes", async () => {
    project = createTempProject();
    const contentHash = writeLeafPackage();
    writeConsumerManifest();
    writeLocalLock({ contentHash, deployedHashes: false });
    writeDeployedHarnessFile();
    const beforeLock = readLockBytes(project.cwd);
    const beforeAgents = listFilesRecursive(join(project.cwd, ".agents"));

    const err = await expectRejectsMatching(
      () => runFrozen(),
      /under.?record|does not record|lock/i,
    );
    expect((err as { code?: string }).code).toBe("INSTALL_FROZEN_UNDER_RECORDED");
    expect((err as { details?: { package?: string } }).details?.package).toBe("leaf");

    expect(Buffer.compare(readLockBytes(project.cwd), beforeLock)).toBe(0);
    expect(listFilesRecursive(join(project.cwd, ".agents"))).toEqual(beforeAgents);
    if (existsSync(modulesDir(project.cwd))) {
      expect(listFilesRecursive(modulesDir(project.cwd))).toEqual([]);
    }
  });

  test("frozen passes when the lock records deployed hashes and local content_hash", async () => {
    project = createTempProject();
    const contentHash = writeLeafPackage();
    writeConsumerManifest();
    writeLocalLock({ contentHash });
    writeDeployedHarnessFile();
    const beforeLock = readLockBytes(project.cwd);

    await expect(runFrozen()).resolves.toMatchObject({ ok: true });
    expect(Buffer.compare(readLockBytes(project.cwd), beforeLock)).toBe(0);
  });

  test("local package with matching content_hash passes", async () => {
    project = createTempProject();
    const contentHash = writeLeafPackage();
    writeConsumerManifest();
    writeLocalLock({ contentHash });
    writeDeployedHarnessFile();

    await expect(runFrozen()).resolves.toMatchObject({ ok: true });
  });

  test("local content change fails frozen with the actionable code", async () => {
    project = createTempProject();
    const recordedHash = writeLeafPackage();
    writeConsumerManifest();
    writeLocalLock({ contentHash: recordedHash });
    writeDeployedHarnessFile();
    // Drift the local package after the lock snapshot was recorded.
    writeText(
      join(project.cwd, "leaf", ".apm", "skills", "hello", "SKILL.md"),
      "---\nname: hello\n---\n# Changed\n",
    );
    const beforeLock = readLockBytes(project.cwd);

    const err = await expectRejectsMatching(
      () => runFrozen(),
      /local content changed|content_hash/i,
    );
    expect((err as { code?: string }).code).toBe("INSTALL_FROZEN_UNDER_RECORDED");
    expect((err as { details?: { reason?: string } }).details?.reason).toBe(
      "local_content_changed",
    );
    expect(Buffer.compare(readLockBytes(project.cwd), beforeLock)).toBe(0);
  });

  test("local package without content_hash fails frozen", async () => {
    project = createTempProject();
    writeLeafPackage();
    writeConsumerManifest();
    writeLocalLock({});
    writeDeployedHarnessFile();

    const err = await expectRejectsMatching(() => runFrozen(), /content_hash|tree_sha256/i);
    expect((err as { code?: string }).code).toBe("INSTALL_FROZEN_UNDER_RECORDED");
    expect((err as { details?: { reason?: string } }).details?.reason).toBe(
      "missing_local_content_hash",
    );
  });

  test("git package without deployed inventory fails frozen", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: frozen-git-under-record\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/one.git\n      ref: main\n`,
    );

    const ports = createFakePorts({ commitsByRef: { main: COMMIT } });
    const downloader = {
      async download(args: { dest: string; commit?: string }): Promise<void> {
        mkdirSync(args.dest, { recursive: true });
        writeText(
          join(args.dest, "apm.yml"),
          `name: one\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
        );
        writeText(
          join(args.dest, ".apm", "skills", "git-skill", "SKILL.md"),
          "---\nname: git-skill\n---\n# Git\n",
        );
      },
    };

    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    getRegisterIntegration(
      api,
      registry,
    )({
      id: "cursor",
      deployRoots: [".agents/skills", ".cursor"],
      detect: () => true,
      materialize: async () => ({ targetId: "cursor", deployedFiles: [] }),
    });
    const baseOptions = {
      cwd: project.cwd,
      forcedTarget: "cursor",
      forceTarget: "cursor",
      integrationRegistry: registry,
      registry,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader,
    };

    // Warm install writes tree_sha256 but its target reports no files, so the
    // lock has no deployed inventory for the primitive-owning package.
    await expect(getRunInstall()(baseOptions)).resolves.toMatchObject({ ok: true });
    const beforeLock = readLockBytes(project.cwd);

    const err = await expectRejectsMatching(
      () => getRunInstall()({ ...baseOptions, frozen: true }),
      /under.?record|does not record|deployed/i,
    );
    expect((err as { code?: string }).code).toBe("INSTALL_FROZEN_UNDER_RECORDED");
    expect((err as { details?: { package?: string } }).details?.package).toBe("one");
    expect(Buffer.compare(readLockBytes(project.cwd), beforeLock)).toBe(0);
  });

  test("root-only manifest with no dependency primitives does not fail", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: root-only\nversion: 0.0.1\ndependencies:\n  mcp:\n    - name: local\n      registry: false\n      transport: stdio\n      command: echo\n`,
    );
    // A root primitive is attributed to `local` without a package; root is not
    // a lock dependency, so frozen must not demand a file inventory for it.
    writeText(
      join(project.cwd, ".apm", "skills", "root-skill", "SKILL.md"),
      "---\nname: root-skill\n---\n# Root\n",
    );
    writeLock(project.cwd, "bapm.lock.yaml", `lockfile_version: "1"\ndependencies: []\n`);
    const beforeLock = readLockBytes(project.cwd);

    await expect(runFrozen()).resolves.toMatchObject({ ok: true });
    expect(Buffer.compare(readLockBytes(project.cwd), beforeLock)).toBe(0);
  });
});

function sha256(content: string): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}
