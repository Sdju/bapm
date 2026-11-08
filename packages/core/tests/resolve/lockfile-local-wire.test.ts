/**
 * Local lock wire compatibility with APM v0.35 (`_local/*` + local fields).
 * bapm keeps its `local:<rel>` / `path` aliases but also writes the APM fields.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import {
  computeCanonicalTreeSha256,
  isGitSourcedLockEntry,
  loadLockfile,
  parseLockfile,
  resolveAndLock,
} from "@b-apm/core";
import {
  createFakePorts,
  createTempProject,
  fakeCommit,
  writeManifest,
  writeText,
  type TempProject,
} from "./helpers.ts";

const HASH_64 = "b".repeat(64);

function writePackageAt(cwd: string, relDir: string, name: string, depsYaml = "  apm: []\n"): void {
  writeText(
    join(cwd, relDir, "apm.yml"),
    `name: ${name}\nversion: 0.0.1\ndependencies:\n${depsYaml}`,
  );
}

function writeRootApm(cwd: string, apmEntriesYaml: string): void {
  writeManifest(
    cwd,
    "apm.yml",
    `name: root\nversion: 0.0.1\ndependencies:\n  apm:\n${apmEntriesYaml}`,
  );
}

function localRow(cwd: string, name: string): Record<string, unknown> {
  const deps = loadLockfile({ cwd }).document.dependencies ?? [];
  const row = deps.find((d) => String(d.name ?? "") === name);
  expect(row).toBeTruthy();
  return row as Record<string, unknown>;
}

describe("local lock wire", () => {
  const projects: TempProject[] = [];

  afterEach(() => {
    projects.splice(0).forEach((p) => p.cleanup());
  });

  test("bapm-written local row carries APM fields and a tree content_hash", async () => {
    const project = createTempProject();
    projects.push(project);
    writePackageAt(project.cwd, "pkgs/a", "pkg-a");
    writeText(join(project.cwd, "pkgs/a/skills/local/SKILL.md"), "# local\n");
    writeRootApm(project.cwd, "    - path: ./pkgs/a\n");

    await resolveAndLock({ cwd: project.cwd });

    const row = localRow(project.cwd, "pkg-a");
    expect(row).toMatchObject({
      repo_url: "local:pkgs/a",
      source: "local",
      path: "pkgs/a",
      local_path: "pkgs/a",
      package_type: "local",
      depth: 1,
      resolved_by: "root->pkg-a",
      declaring_parent: "root",
    });
    expect(row.content_hash).toBe(computeCanonicalTreeSha256(join(project.cwd, "pkgs/a")));
    expect(String(row.content_hash)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test("changed local content changes content_hash", async () => {
    const project = createTempProject();
    projects.push(project);
    writePackageAt(project.cwd, "pkgs/a", "pkg-a");
    writeText(join(project.cwd, "pkgs/a/skills/local/SKILL.md"), "# one\n");
    writeRootApm(project.cwd, "    - path: ./pkgs/a\n");

    await resolveAndLock({ cwd: project.cwd });
    const first = localRow(project.cwd, "pkg-a").content_hash;

    writeText(join(project.cwd, "pkgs/a/skills/local/SKILL.md"), "# two\n");
    await resolveAndLock({ cwd: project.cwd });

    const second = localRow(project.cwd, "pkg-a").content_hash;
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
  });

  test("transitive local row records declaring_parent, depth and resolved_by", async () => {
    const project = createTempProject();
    projects.push(project);
    writeManifest(
      project.cwd,
      "apm.yml",
      `name: root\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./mid\n`,
    );
    writePackageAt(project.cwd, "mid", "mid", "  apm:\n    - path: ../leaf\n");
    writePackageAt(project.cwd, "leaf", "leaf");

    await resolveAndLock({ cwd: project.cwd });

    const leaf = localRow(project.cwd, "leaf");
    expect(leaf).toMatchObject({
      source: "local",
      path: "leaf",
      // APM semantics: transitive local_path is relative to the declaring package.
      local_path: "../leaf",
      depth: 2,
      resolved_by: "root->mid->leaf",
      declaring_parent: "mid",
      package_type: "local",
    });
    expect(leaf.content_hash).toBe(computeCanonicalTreeSha256(join(project.cwd, "leaf")));

    const mid = localRow(project.cwd, "mid");
    expect(mid).toMatchObject({
      path: "mid",
      local_path: "mid",
      depth: 1,
      resolved_by: "root->mid",
      declaring_parent: "root",
    });
  });

  test("APM-shaped _local/<name> + local_path fixture is matched and preserved on rewrite", async () => {
    const project = createTempProject();
    projects.push(project);
    writePackageAt(project.cwd, "pkgs/foo", "foo");
    writeText(join(project.cwd, "pkgs/foo/skills/foo/SKILL.md"), "# foo\n");
    writeRootApm(project.cwd, "    - path: ./pkgs/foo\n");
    writeText(
      join(project.cwd, "bapm.lock.yaml"),
      [
        'lockfile_version: "1"',
        "dependencies:",
        "  - repo_url: _local/foo",
        "    name: foo",
        "    source: local",
        "    local_path: ./pkgs/foo",
        "    declaring_parent: _local/parent",
        "    depth: 1",
        "    resolved_by: _local/parent",
        "    package_type: local",
        `    content_hash: ${HASH_64}`,
        "    is_dev: true",
        "    anchored_local_path: /tmp/anchored/foo",
        "    deployed_file_hashes:",
        `      skills/foo/SKILL.md: ${HASH_64}`,
        "",
      ].join("\n"),
    );

    await resolveAndLock({ cwd: project.cwd });

    const row = localRow(project.cwd, "foo");
    // bapm keeps writing its own repo identity for now (documented alias).
    expect(row.repo_url).toBe("local:pkgs/foo");
    expect(row.path).toBe("pkgs/foo");
    expect(row.local_path).toBe("pkgs/foo");
    expect(row.deployed_file_hashes).toBeTruthy();
    expect((row.deployed_file_hashes as Record<string, string>)["skills/foo/SKILL.md"]).toBe(
      `sha256:${HASH_64}`,
    );
    // APM-only evidence survives the round-trip.
    expect(row.is_dev).toBe(true);
    expect(row.anchored_local_path).toBe("/tmp/anchored/foo");
    // Recomputing from content replaces the stale fixture hash.
    expect(row.content_hash).toBe(computeCanonicalTreeSha256(join(project.cwd, "pkgs/foo")));
    expect(row.content_hash).not.toBe(`sha256:${HASH_64}`);
  });

  test("APM _local row without source parses as local and is not git-sourced", () => {
    const doc = parseLockfile(
      [
        'lockfile_version: "1"',
        "dependencies:",
        "  - repo_url: _local/foo",
        "    name: foo",
        "    local_path: ./pkgs/foo",
        `    content_hash: ${HASH_64}`,
        "",
      ].join("\n"),
    );

    const dep = doc.dependencies[0]!;
    expect(dep.local_path).toBe("./pkgs/foo");
    expect(dep.content_hash).toBe(`sha256:${HASH_64}`);
    expect(isGitSourcedLockEntry(dep)).toBe(false);
  });

  test("non-local rows do not gain local wire fields", async () => {
    const project = createTempProject();
    projects.push(project);
    const ports = createFakePorts({
      commitsByRef: { main: fakeCommit("local-wire-git") },
    });
    writeManifest(
      project.cwd,
      "apm.yml",
      `name: root\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/repo.git\n      ref: main\n`,
    );

    await resolveAndLock({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    const deps = loadLockfile({ cwd: project.cwd }).document.dependencies ?? [];
    const git = deps.find((d) => String(d.repo_url ?? "").includes("example/repo"));
    expect(git).toBeTruthy();
    const row = git as Record<string, unknown>;
    expect(row.local_path).toBeUndefined();
    expect(row.package_type).toBeUndefined();
    expect(row.content_hash).toBeUndefined();
    expect(row.declaring_parent).toBeUndefined();
    expect(row.is_dev).toBeUndefined();
    expect(typeof row.resolved_commit).toBe("string");
  });
});
