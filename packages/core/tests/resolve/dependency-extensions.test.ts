/**
 * APM req-ext-003: dependency-manifest `x-*` fields are copied into the lock
 * row `extensions` map and omitted when the dependency declares none.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import {
  loadLockfile,
  resolveAndLock,
  resolveDependencyGraph,
  serializeLockfile,
} from "@b-apm/core";
import {
  createFakePorts,
  createTempProject,
  depsOf,
  fakeCommit,
  lockOf,
  writeManifest,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("dependency extensions → lock row", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("git dependency manifest x-* fields become row extensions", async () => {
    project = createTempProject();
    const ports = createFakePorts({ commitsByRef: { main: fakeCommit("ext-main") } });
    const originalDownload = ports.downloader.download.bind(ports.downloader);
    ports.downloader.download = async (args) => {
      await originalDownload(args);
      if (args.repoUrl?.includes("with-ext")) {
        writeText(
          join(args.dest, "apm.yml"),
          `name: with-ext\nversion: 1.0.0\nx-acme-owner: platform\nx-acme-tier: 2\ndependencies:\n  apm: []\n`,
        );
      }
    };
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: ext-root\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/with-ext.git\n      ref: main\n`,
    );

    const result = await resolveDependencyGraph({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });
    const row = depsOf(lockOf(result)).find((dep) => String(dep.repo_url).includes("with-ext"))!;
    expect(row.extensions).toEqual({ "x-acme-owner": "platform", "x-acme-tier": 2 });
  });

  test("extension-free dependency omits the lock field", async () => {
    project = createTempProject();
    const ports = createFakePorts({ commitsByRef: { main: fakeCommit("plain-main") } });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: plain-root\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/plain.git\n      ref: main\n`,
    );

    const result = await resolveDependencyGraph({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });
    const row = depsOf(lockOf(result)).find((dep) => String(dep.repo_url).includes("plain"))!;
    expect(row.extensions).toBeUndefined();
  });

  test("written lockfile carries local dependency extensions and round-trips", async () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "pkg/apm.yml"),
      `name: local-ext\nversion: 0.0.1\nx-acme-local: true\ndependencies:\n  apm: []\n`,
    );
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: local-ext-root\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./pkg\n`,
    );
    const ports = createFakePorts();

    const result = await resolveAndLock({
      cwd: project.cwd,
      downloader: ports.downloader,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
    });

    const written = loadLockfile({ path: result.lockPath });
    const row = written.document.dependencies.find((dep) => dep.name === "local-ext")!;
    expect(row.extensions).toEqual({ "x-acme-local": true });

    const yaml = serializeLockfile(written.document);
    expect(yaml).toMatch(/extensions:/);
    expect(yaml).toMatch(/x-acme-local/);
  });
});
