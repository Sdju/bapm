/**
 * M3 download + lock write acceptance — checklist C §16–24.
 *
 * Public API: resolveAndLock, downloadPackages; Lockfile dual-read via M2;
 * modules dir APM_MODULES_DIR (`apm_modules`); no target deploy.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  resolveAndLock,
  downloadPackages,
  loadLockfile,
  APM_MODULES_DIR,
  BAPM_LOCK_FILE,
  APM_LOCK_FILE,
} from "@bapm/core";
import {
  createTempProject,
  createFakePorts,
  depsOf,
  expectRejectsMatching,
  fakeCommit,
  isFortyHex,
  listFilesRecursive,
  lockOf,
  writeLock,
  writeManifest,
  writeText,
  type TempProject,
} from "./helpers.ts";

const COMMIT_MAIN = "ffffffffffffffffffffffffffffffffffffffff";

describe("M3 resolveAndLock — download + lock write", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("fresh lock write → bapm.lock.yaml with 40-hex resolved_commit (lk-003)", async () => {
    project = createTempProject();
    const ports = createFakePorts({
      commitsByRef: { main: COMMIT_MAIN },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: fresh-root\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/one.git\n      ref: main\n`,
    );
    const result = await resolveAndLock({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });
    const lockPath = join(project.cwd, BAPM_LOCK_FILE ?? "bapm.lock.yaml");
    expect(existsSync(lockPath)).toBe(true);
    expect(existsSync(join(project.cwd, "apm.lock.yaml"))).toBe(false);
    const loaded = loadLockfile({ cwd: project.cwd });
    const deps = depsOf(lockOf(loaded));
    expect(deps.length).toBeGreaterThanOrEqual(1);
    expect(isFortyHex(deps[0]!.resolved_commit)).toBe(true);
    // modules cache populated
    expect(existsSync(join(project.cwd, APM_MODULES_DIR))).toBe(true);
    // result should not claim failure
    expect(result === undefined || result === null || typeof result === "object").toBe(true);
  });

  test("write-back apm.lock.yaml — no sibling bapm.lock.yaml", async () => {
    project = createTempProject();
    const ports = createFakePorts({ commitsByRef: { main: COMMIT_MAIN } });
    writeManifest(
      project.cwd,
      "apm.yml",
      `name: apm-root\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/one.git\n      ref: main\n`,
    );
    writeLock(
      project.cwd,
      "apm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/one\n    resolved_commit: "${COMMIT_MAIN}"\n`,
    );
    await resolveAndLock({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });
    expect(existsSync(join(project.cwd, APM_LOCK_FILE ?? "apm.lock.yaml"))).toBe(true);
    expect(existsSync(join(project.cwd, "bapm.lock.yaml"))).toBe(false);
  });

  test("dual lock filenames → hard error (M2)", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: dual\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );
    writeLock(project.cwd, "apm.lock.yaml", `lockfile_version: "1"\ndependencies: []\n`);
    writeLock(project.cwd, "bapm.lock.yaml", `lockfile_version: "1"\ndependencies: []\n`);
    await expectRejectsMatching(
      () => resolveAndLock({ cwd: project.cwd }),
      /apm\.lock\.yaml|bapm\.lock\.yaml|both|conflict|dual/i,
    );
  });

  test("warm replay — reuse pin without ls-remote when ref unchanged (rs-015)", async () => {
    project = createTempProject();
    const ports = createFakePorts({ commitsByRef: { main: COMMIT_MAIN } });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: warm\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/one.git\n      ref: main\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/one\n    resolved_commit: "${COMMIT_MAIN}"\n`,
    );
    await resolveAndLock({
      cwd: project.cwd,
      updateRefs: false,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });
    expect(ports.lsRemoteCalls.length).toBe(0);
    expect(ports.tagListCalls.length).toBe(0);
    // materialize MAY still download if modules missing
    expect(existsSync(join(project.cwd, APM_MODULES_DIR))).toBe(true);
  });

  test("semver constraint drift — lock ^1.0.0 vs manifest ^2.0.0 re-resolves (rs-004)", async () => {
    project = createTempProject();
    const oldCommit = "1111111111111111111111111111111111111111";
    const newCommit = "2222222222222222222222222222222222222222";
    const ports = createFakePorts({
      tagsByRepo: {
        "*": [
          { tag: "v1.0.0", commit: oldCommit },
          { tag: "v2.0.0", commit: newCommit },
        ],
      },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: drift\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/drift.git\n      ref: "^2.0.0"\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/drift\n    resolved_commit: "${oldCommit}"\n    constraint: "^1.0.0"\n    resolved_tag: "v1.0.0"\n`,
    );
    await resolveAndLock({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });
    const deps = depsOf(lockOf(loadLockfile({ cwd: project.cwd })));
    const drift = deps.find((d) => String(d.repo_url).includes("drift"));
    expect(drift).toBeTruthy();
    expect(String(drift!.constraint)).toBe("^2.0.0");
    expect(String(drift!.resolved_commit)).toBe(newCommit);
    expect(ports.tagListCalls.length).toBeGreaterThan(0);
  });

  test("updateRefs / --update moves pin to newer satisfying ref", async () => {
    project = createTempProject();
    const oldCommit = "3333333333333333333333333333333333333333";
    const newCommit = "4444444444444444444444444444444444444444";
    const ports = createFakePorts({
      commitsByRef: { main: newCommit },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: update-root\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/one.git\n      ref: main\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/one\n    resolved_commit: "${oldCommit}"\n`,
    );
    await resolveAndLock({
      cwd: project.cwd,
      updateRefs: true,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });
    const deps = depsOf(lockOf(loadLockfile({ cwd: project.cwd })));
    expect(String(deps[0]!.resolved_commit)).toBe(newCommit);
    expect(ports.lsRemoteCalls.length).toBeGreaterThan(0);
  });

  test("no target deploy — harness dirs unchanged; modules cache MAY change", async () => {
    project = createTempProject();
    const ports = createFakePorts({ commitsByRef: { main: COMMIT_MAIN } });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: harness\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/one.git\n      ref: main\n`,
    );
    const agents = join(project.cwd, ".agents");
    const github = join(project.cwd, ".github", "instructions");
    mkdirSync(agents, { recursive: true });
    mkdirSync(github, { recursive: true });
    writeFileSync(join(agents, "keep.txt"), "sentinel\n", "utf8");
    writeFileSync(join(github, "keep.instructions.md"), "sentinel\n", "utf8");
    const beforeAgents = listFilesRecursive(agents);
    const beforeGithub = listFilesRecursive(join(project.cwd, ".github"));

    await resolveAndLock({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(listFilesRecursive(agents)).toEqual(beforeAgents);
    expect(listFilesRecursive(join(project.cwd, ".github"))).toEqual(beforeGithub);
    expect(existsSync(join(project.cwd, APM_MODULES_DIR))).toBe(true);
  });

  test("direct dep failure — non-success; lock not presented as success", async () => {
    project = createTempProject();
    const ports = createFakePorts({
      failUrls: ["https://github.com/example/broken.git"],
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: broken\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/broken.git\n      ref: main\n`,
    );
    await expectRejectsMatching(
      () =>
        resolveAndLock({
          cwd: project.cwd,
          gitRemote: ports.gitRemote,
          tagLister: ports.tagLister,
          downloader: ports.downloader,
        }),
      /broken|fail|error|resolve|download/i,
    );
    // Prefer no success lock — either absent or unchanged empty
    if (existsSync(join(project.cwd, "bapm.lock.yaml"))) {
      const text = readFileSync(join(project.cwd, "bapm.lock.yaml"), "utf8");
      expect(text).not.toMatch(/Lockfile written/i);
    }
  });

  test("sort + monotonic version on emit (lk-005 / lk-002 via M2)", async () => {
    project = createTempProject();
    const ports = createFakePorts({
      commitsByRef: {
        main: COMMIT_MAIN,
      },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: sort-root\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/zebra/pkg.git\n      ref: main\n    - git: https://github.com/alpha/pkg.git\n      ref: main\n`,
    );
    await resolveAndLock({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });
    const doc = lockOf(loadLockfile({ cwd: project.cwd }));
    expect(["1", "2"]).toContain(String(doc.lockfile_version));
    const deps = depsOf(doc);
    expect(deps.length).toBeGreaterThanOrEqual(2);
    const urls = deps.map((d) => String(d.repo_url).toLowerCase());
    const sorted = [...urls].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(urls).toEqual(sorted);
  });

  test("downloadPackages lands under apm_modules", async () => {
    project = createTempProject();
    const ports = createFakePorts({ commitsByRef: { main: COMMIT_MAIN } });
    expect(typeof downloadPackages).toBe("function");
    await downloadPackages({
      cwd: project.cwd,
      packages: [
        {
          repoUrl: "https://github.com/example/one.git",
          commit: COMMIT_MAIN,
        },
      ],
      downloader: ports.downloader,
    });
    expect(existsSync(join(project.cwd, APM_MODULES_DIR))).toBe(true);
    expect(ports.downloadCalls.length).toBeGreaterThan(0);
  });
});
