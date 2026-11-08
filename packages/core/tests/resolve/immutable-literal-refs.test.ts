/**
 * APM 0.32 immutable literal requirement admission.
 *
 * Literal `git` + `ref` edges to one package identity must prove the same
 * commit. Different ref names that peel to the same commit are equivalent;
 * semver ranges keep the existing intersection-pick policy.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveDependencyGraph, ResolverError } from "@b-apm/core";
import { asText } from "../asText.ts";
import {
  createFakePorts,
  createTempProject,
  expectRejectsMatching,
  fakeCommit,
  graphNodes,
  writeManifest,
  type TempProject,
} from "./helpers.ts";

const URL = "https://github.com/example/shared.git";

describe("immutable literal git refs", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("different literal refs resolving to different commits fail closed with both chains", async () => {
    project = createTempProject();
    const first = fakeCommit("shared-main");
    const second = fakeCommit("shared-v1");
    const ports = createFakePorts({
      commitsByRef: { main: first, v1: second },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: immutable-root\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: ${URL}\n      ref: main\n    - git: ${URL}\n      ref: v1\n`,
    );

    const error = await expectRejectsMatching(
      () =>
        resolveDependencyGraph({
          cwd: project!.cwd,
          gitRemote: ports.gitRemote,
          tagLister: ports.tagLister,
          downloader: ports.downloader,
        }),
      /incompatible immutable requirements/i,
    );

    expect(error).toBeInstanceOf(ResolverError);
    expect((error as ResolverError).code).toBe("RESOLVE_IMMUTABLE_CONFLICT");
    const text = (error as Error).message;
    expect(text).toMatch(/immutable-root->shared@main/);
    expect(text).toMatch(/immutable-root->shared@v1/);
    expect(text).toContain(first);
    expect(text).toContain(second);
    expect(text).toMatch(/Align the requested refs/i);
  });

  test("different ref names resolving to the same commit are accepted", async () => {
    project = createTempProject();
    const commit = fakeCommit("shared-equivalent");
    const ports = createFakePorts({
      commitsByRef: { main: commit, release: commit },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: equivalent-root\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: ${URL}\n      ref: main\n    - git: ${URL}\n      ref: release\n`,
    );

    const result = await resolveDependencyGraph({
      cwd: project!.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });
    const shared = graphNodes(result).filter((node) =>
      asText(node.repo_url ?? "").includes("example/shared"),
    );
    expect(shared).toHaveLength(1);
    expect(shared[0]!.resolved_commit).toBe(commit);
  });

  test("identical literal refs need no equivalence conflict", async () => {
    project = createTempProject();
    const commit = fakeCommit("shared-same");
    const ports = createFakePorts({ commitsByRef: { main: commit } });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: same-ref-root\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: ${URL}\n      ref: main\n    - git: ${URL}\n      ref: main\n`,
    );

    const result = await resolveDependencyGraph({
      cwd: project!.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });
    expect(
      graphNodes(result).filter((node) => asText(node.repo_url ?? "").includes("example/shared")),
    ).toHaveLength(1);
  });

  test("distinct virtual packages are distinct identities for the check", async () => {
    project = createTempProject();
    const ports = createFakePorts({
      commitsByRef: { main: fakeCommit("mono-main"), v1: fakeCommit("mono-v1") },
    });
    const originalDownload = ports.downloader.download.bind(ports.downloader);
    ports.downloader.download = async (args) => {
      await originalDownload(args);
      for (const virtual of ["packages/a", "packages/b"]) {
        const root = join(args.dest, ...virtual.split("/"));
        mkdirSync(root, { recursive: true });
        const name = virtual.endsWith("/a") ? "a" : "b";
        writeFileSync(
          join(root, "apm.yml"),
          `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
          "utf8",
        );
      }
    };
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: mono-root\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: ${URL}\n      ref: main\n      path: packages/a\n    - git: ${URL}\n      ref: v1\n      path: packages/b\n`,
    );

    const result = await resolveDependencyGraph({
      cwd: project!.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });
    // The immutable check must not fire: bapm's APM unique key includes the
    // virtual path. (Graph dedup still keys by repo identity today, so one of
    // the two virtual packages wins materialization; that identity gap is
    // tracked separately from this fail-closed admission check.)
    const shared = graphNodes(result).filter((node) =>
      asText(node.repo_url ?? "").includes("example/shared"),
    );
    expect(shared.length).toBeGreaterThanOrEqual(1);
    expect(["packages/a", "packages/b"]).toContain(shared[0]!.virtualPath);
  });

  test("semver range collisions keep intersection-pick (not immutable check)", async () => {
    project = createTempProject();
    const ports = createFakePorts({
      tagsByRepo: {
        "example/shared": [
          { tag: "v1.0.0", commit: fakeCommit("v100") },
          { tag: "v2.0.0", commit: fakeCommit("v200") },
        ],
      },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: semver-root\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: ${URL}\n      ref: ^1.0.0\n    - git: ${URL}\n      ref: ^2.0.0\n`,
    );

    await expectRejectsMatching(
      () =>
        resolveDependencyGraph({
          cwd: project!.cwd,
          gitRemote: ports.gitRemote,
          tagLister: ports.tagLister,
          downloader: ports.downloader,
        }),
      /empty intersection/i,
    );
  });
});
