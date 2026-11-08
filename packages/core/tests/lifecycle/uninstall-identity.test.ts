/**
 * Core uninstall — exact package identity matching.
 *
 * Covers name vs prefix (no substring), full git URL, alias, path basename,
 * path package name != basename, and transitive pruning.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import {
  createTempProject,
  getRunUninstall,
  loadLockDeps,
  nameOfDep,
  readManifestText,
  writeLock,
  writeManifest,
  type TempProject,
} from "./helpers.ts";

function manifestLines(cwd: string): string[] {
  return readManifestText(cwd)
    .split(/\r?\n/)
    .map((line) => line.trim());
}

function lockNames(cwd: string): string[] {
  return loadLockDeps(cwd).map(nameOfDep).sort();
}

describe("core uninstall identity matching", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("short name does not remove a longer package (foo vs foo-bar)", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: uninstall-prefix\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./foo\n    - path: ./foo-bar\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"
dependencies:
  - repo_url: local:foo
    name: foo
    source: local
    path: foo
  - repo_url: local:foo-bar
    name: foo-bar
    source: local
    path: foo-bar
`,
    );

    await getRunUninstall()({ cwd: project.cwd, packages: ["foo"], names: ["foo"] });

    const lines = manifestLines(project.cwd);
    expect(lines).not.toContain("- path: ./foo");
    expect(lines).toContain("- path: ./foo-bar");
    expect(lockNames(project.cwd)).toEqual(["foo-bar"]);
  });

  test("exact name removes only that package", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: uninstall-exact\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/alpha.git\n    - git: https://github.com/example/beta.git\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"
dependencies:
  - repo_url: github.com/example/alpha
    name: alpha
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  - repo_url: github.com/example/beta
    name: beta
    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
`,
    );

    await getRunUninstall()({ cwd: project.cwd, packages: ["alpha"], names: ["alpha"] });

    const manifest = readManifestText(project.cwd);
    expect(manifest).toContain("example/beta");
    expect(manifest).not.toContain("example/alpha");
    expect(lockNames(project.cwd)).toEqual(["beta"]);
  });

  test("full git URL removes the entry even when its lock name differs from the URL tail", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: uninstall-url\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/alpha.git\n    - git: https://github.com/example/beta.git\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"
dependencies:
  - repo_url: github.com/example/alpha
    name: alpha-pkg
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  - repo_url: github.com/example/beta
    name: beta-pkg
    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
`,
    );

    await getRunUninstall()({
      cwd: project.cwd,
      packages: ["https://github.com/example/alpha.git"],
      names: ["https://github.com/example/alpha.git"],
    });

    const manifest = readManifestText(project.cwd);
    expect(manifest).toContain("example/beta");
    expect(manifest).not.toContain("example/alpha");
    expect(lockNames(project.cwd)).toEqual(["beta-pkg"]);
  });

  test("git URL basename / short name matches the right entry", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: uninstall-short-git\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/alpha.git\n    - git: https://github.com/example/beta.git\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"
dependencies:
  - repo_url: github.com/example/alpha
    name: alpha-pkg
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  - repo_url: github.com/example/beta
    name: beta-pkg
    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
`,
    );

    await getRunUninstall()({ cwd: project.cwd, packages: ["alpha"], names: ["alpha"] });

    expect(lockNames(project.cwd)).toEqual(["beta-pkg"]);
    expect(readManifestText(project.cwd)).not.toContain("example/alpha");
  });

  test("manifest alias removes both manifest entry and its lock entry", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: uninstall-alias\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/acme/tool.git\n      alias: my-tool\n    - git: https://github.com/acme/keep.git\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"
dependencies:
  - repo_url: github.com/acme/tool
    name: tool
    resolved_commit: "cccccccccccccccccccccccccccccccccccccccc"
  - repo_url: github.com/acme/keep
    name: keep
    resolved_commit: "dddddddddddddddddddddddddddddddddddddddd"
`,
    );

    await getRunUninstall()({ cwd: project.cwd, packages: ["my-tool"], names: ["my-tool"] });

    const manifest = readManifestText(project.cwd);
    expect(manifest).not.toContain("my-tool");
    expect(manifest).not.toContain("acme/tool");
    expect(manifest).toContain("acme/keep");
    expect(lockNames(project.cwd)).toEqual(["keep"]);
  });

  test("path basename removes the path entry and its lock entry", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: uninstall-path-basename\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./pkgdir\n    - path: ./keepdir\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"
dependencies:
  - repo_url: local:pkgdir
    name: "@acme/tool"
    source: local
    path: pkgdir
  - repo_url: local:keepdir
    name: keep
    source: local
    path: keepdir
`,
    );

    await getRunUninstall()({ cwd: project.cwd, packages: ["pkgdir"], names: ["pkgdir"] });

    const lines = manifestLines(project.cwd);
    expect(lines).not.toContain("- path: ./pkgdir");
    expect(lines).toContain("- path: ./keepdir");
    expect(lockNames(project.cwd)).toEqual(["keep"]);
  });

  test("path dependency package name != path basename removes both manifest and lock", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: uninstall-path-name\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./pkgdir\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"
dependencies:
  - repo_url: local:pkgdir
    name: "@acme/tool"
    source: local
    path: pkgdir
`,
    );

    await getRunUninstall()({
      cwd: project.cwd,
      packages: ["@acme/tool"],
      names: ["@acme/tool"],
    });

    expect(manifestLines(project.cwd)).not.toContain("- path: ./pkgdir");
    expect(lockNames(project.cwd)).toEqual([]);
  });

  test("transitives are pruned only when their parents are removed", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: uninstall-transitives\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/app-a.git\n    - git: https://github.com/example/app-b.git\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"
dependencies:
  - repo_url: github.com/example/app-a
    name: app-a
    resolved_commit: "1111111111111111111111111111111111111111"
    resolved_by: root
    depth: 1
  - repo_url: github.com/example/shared-a
    name: shared-a
    resolved_commit: "2222222222222222222222222222222222222222"
    resolved_by: root->app-a
    depth: 2
  - repo_url: github.com/example/app-b
    name: app-b
    resolved_commit: "3333333333333333333333333333333333333333"
    resolved_by: root
    depth: 1
  - repo_url: github.com/example/shared-b
    name: shared-b
    resolved_commit: "4444444444444444444444444444444444444444"
    resolved_by: root->app-b
    depth: 2
  - repo_url: github.com/example/shared-common
    name: shared-common
    resolved_commit: "5555555555555555555555555555555555555555"
    resolved_by:
      - root->app-a
      - root->app-b
    depth: 2
`,
    );

    await getRunUninstall()({ cwd: project.cwd, packages: ["app-a"], names: ["app-a"] });

    expect(lockNames(project.cwd)).toEqual(["app-b", "shared-b", "shared-common"]);
    const manifest = readManifestText(project.cwd);
    expect(manifest).toContain("example/app-b");
    expect(manifest).not.toContain("example/app-a");
  });
});
