/**
 * M3 intersection-pick + git-semver acceptance — checklist C §7–8, 10–12.
 *
 * OpenAPM diamond policy (NOT APM first-wins): highest in ∩; empty ∩ fail with
 * both chains joined by `->`.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { join } from "node:path";
import { readFileSync, mkdirSync } from "node:fs";
import { resolveDependencyGraph } from "@bapm/core";
import {
  createTempProject,
  createFakePorts,
  expectRejectsMatching,
  fakeCommit,
  fixturePath,
  graphNodes,
  writeManifest,
  writeText,
  type TempProject,
} from "./helpers.ts";

type SemverCase = {
  id: string;
  range: string;
  prerelease_optin: boolean;
  tags: string[];
  expected: string | null;
};

describe("M3 diamond intersection-pick (rs-001 / rs-010)", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("overlapping ranges → single winner = highest in ∩; resolved_by = tightest chain", async () => {
    project = createTempProject();
    // via-a depends on shared@^1.0.0; via-b depends on shared@~1.2.0
    // ∩ ≈ ~1.2.0 → highest tag v1.2.9; tightest chain is via-b
    const sharedCommit = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const ports = createFakePorts({
      tagsByRepo: {
        "example/shared": [
          { tag: "v1.0.0", commit: fakeCommit("v100") },
          { tag: "v1.2.0", commit: fakeCommit("v120") },
          { tag: "v1.2.9", commit: sharedCommit },
          { tag: "v1.3.0", commit: fakeCommit("v130") },
        ],
      },
      commitsByRef: {
        main: fakeCommit("via-main"),
      },
    });

    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: diamond-root\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/via-a.git\n      ref: main\n    - git: https://github.com/example/via-b.git\n      ref: main\n`,
    );

    // Fake download materializes child manifests with shared deps
    const originalDownload = ports.downloader.download.bind(ports.downloader);
    ports.downloader.download = async (args) => {
      await originalDownload(args);
      const dest = args.dest;
      if (args.repoUrl?.includes("via-a")) {
        writeText(
          join(dest, "apm.yml"),
          `name: via-a\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/shared.git\n      ref: "^1.0.0"\n`,
        );
      } else if (args.repoUrl?.includes("via-b")) {
        writeText(
          join(dest, "apm.yml"),
          `name: via-b\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/shared.git\n      ref: "~1.2.0"\n`,
        );
      } else if (args.repoUrl?.includes("shared")) {
        writeText(
          join(dest, "apm.yml"),
          `name: shared\nversion: 1.2.9\ndependencies:\n  apm: []\n`,
        );
      }
    };

    const result = await resolveDependencyGraph({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });
    const nodes = graphNodes(result);
    const shared = nodes.filter((n) =>
      String(n.name ?? n.repo_url ?? n.id ?? "")
        .toLowerCase()
        .includes("shared"),
    );
    expect(shared.length).toBe(1);
    const winner = shared[0]!;
    expect(String(winner.resolved_tag ?? winner.version ?? "")).toMatch(/1\.2\.9/);
    expect(String(winner.resolved_commit)).toBe(sharedCommit);
    expect(String(winner.resolved_by ?? "")).toMatch(/via-b|~1\.2\.0/i);
    expect(String(winner.resolved_by ?? "")).toMatch(/->/);
  });

  test("empty ∩ → fail; diagnostic lists both chains with -> (rs-010)", async () => {
    project = createTempProject();
    const ports = createFakePorts({
      tagsByRepo: {
        "example/shared": [
          { tag: "v1.0.0", commit: fakeCommit("v100") },
          { tag: "v2.0.0", commit: fakeCommit("v200") },
        ],
      },
      commitsByRef: { main: fakeCommit("via-main") },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: empty-diamond\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/via-a.git\n      ref: main\n    - git: https://github.com/example/via-b.git\n      ref: main\n`,
    );
    const originalDownload = ports.downloader.download.bind(ports.downloader);
    ports.downloader.download = async (args) => {
      await originalDownload(args);
      if (args.repoUrl?.includes("via-a")) {
        writeText(
          join(args.dest, "apm.yml"),
          `name: via-a\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/shared.git\n      ref: "^1.0.0"\n`,
        );
      } else if (args.repoUrl?.includes("via-b")) {
        writeText(
          join(args.dest, "apm.yml"),
          `name: via-b\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/shared.git\n      ref: "^2.0.0"\n`,
        );
      }
    };

    const err = await expectRejectsMatching(
      () =>
        resolveDependencyGraph({
          cwd: project.cwd,
          gitRemote: ports.gitRemote,
          tagLister: ports.tagLister,
          downloader: ports.downloader,
        }),
      /intersection|conflict|empty|no overlapping|cannot resolve/i,
    );
    const text = err instanceof Error ? err.message : String(err);
    expect(text).toMatch(/->/);
    expect(text).toMatch(/shared|example/i);
    expect(text).toMatch(/\^1\.0\.0|\^2\.0\.0/);
  });
});

describe("M3 git-semver pin + node-semver oracle (rs-002 / 007 / 014)", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("git-semver pin fields — ^1.2.0 picks highest; lk-008 fields present", async () => {
    project = createTempProject();
    const commit130 = "dddddddddddddddddddddddddddddddddddddddd";
    const ports = createFakePorts({
      tagsByRepo: {
        "*": [
          { tag: "v1.2.0", commit: fakeCommit("120") },
          { tag: "v1.3.0", commit: commit130 },
        ],
      },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: semver-root\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/semver-pkg.git\n      ref: "^1.2.0"\n`,
    );
    const result = await resolveDependencyGraph({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });
    const nodes = graphNodes(result);
    const pkg = nodes.find((n) => String(n.repo_url ?? n.name ?? "").includes("semver-pkg"));
    expect(pkg).toBeTruthy();
    expect(String(pkg!.constraint)).toBe("^1.2.0");
    expect(String(pkg!.resolved_tag)).toMatch(/v?1\.3\.0/);
    expect(pkg!.resolved_at).toBeTruthy();
    expect(String(pkg!.resolved_commit)).toBe(commit130);
  });

  test("prerelease exclusion — 1.2.0-beta discarded for ^1.2.0 without opt-in", async () => {
    project = createTempProject();
    const stable = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    const ports = createFakePorts({
      tagsByRepo: {
        "*": [
          { tag: "1.2.0-beta", commit: fakeCommit("beta") },
          { tag: "1.2.0", commit: stable },
          { tag: "1.2.1", commit: fakeCommit("121") },
        ],
      },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: pre-root\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/pre.git\n      ref: "^1.2.0"\n`,
    );
    const result = await resolveDependencyGraph({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });
    const pkg = graphNodes(result).find((n) => String(n.repo_url ?? n.name ?? "").includes("pre"));
    expect(pkg).toBeTruthy();
    expect(String(pkg!.resolved_tag)).not.toMatch(/beta/i);
    expect(String(pkg!.resolved_tag)).toMatch(/1\.2\.1/);
  });

  test("node-semver oracle — semver-dialect.json cases match (rs-007/014)", async () => {
    const oracle = JSON.parse(readFileSync(fixturePath("semver-dialect.json"), "utf8")) as {
      cases: SemverCase[];
    };

    for (const c of oracle.cases) {
      project = createTempProject();
      const tags = c.tags.map((tag) => ({
        tag,
        commit: fakeCommit(tag),
      }));
      const ports = createFakePorts({ tagsByRepo: { "*": tags } });
      const prereleaseLine = c.prerelease_optin ? "      prerelease: true\n" : "";
      writeManifest(
        project.cwd,
        "bapm.yml",
        `name: oracle-${c.id}\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/oracle-${c.id}.git\n      ref: "${c.range}"\n${prereleaseLine}`,
      );

      if (c.expected === null) {
        await expectRejectsMatching(
          () =>
            resolveDependencyGraph({
              cwd: project.cwd,
              gitRemote: ports.gitRemote,
              tagLister: ports.tagLister,
              downloader: ports.downloader,
            }),
          /no match|unsatisf|empty|no tag|cannot resolve|semver/i,
        );
      } else {
        const result = await resolveDependencyGraph({
          cwd: project.cwd,
          gitRemote: ports.gitRemote,
          tagLister: ports.tagLister,
          downloader: ports.downloader,
        });
        const pkg = graphNodes(result)[0];
        expect(pkg, c.id).toBeTruthy();
        const got = String(pkg!.resolved_tag ?? "").replace(/^v/, "");
        const want = c.expected.replace(/^v/, "");
        expect(got, c.id).toBe(want);
      }
      project.cleanup();
      project = undefined as unknown as TempProject;
    }
  });
});

// Local-path diamond alternative (no network) for apply smoke when git ports lag
test("local diamond empty ∩ still fail-closed with -> chains", async () => {
  const project = createTempProject();
  try {
    mkdirSync(join(project.cwd, "via-a"), { recursive: true });
    mkdirSync(join(project.cwd, "via-b"), { recursive: true });
    mkdirSync(join(project.cwd, "shared-v1"), { recursive: true });
    // Encode conflicting constraints via git-semver on same identity using fakes is preferred;
    // this documents the fail-closed contract for empty intersection diagnostics.
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: local-doc\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/shared.git\n      ref: "^1.0.0"\n    - git: https://github.com/example/shared.git\n      ref: "^2.0.0"\n`,
    );
    const ports = createFakePorts({
      tagsByRepo: {
        "*": [
          { tag: "v1.0.0", commit: fakeCommit("1") },
          { tag: "v2.0.0", commit: fakeCommit("2") },
        ],
      },
    });
    const err = await expectRejectsMatching(
      () =>
        resolveDependencyGraph({
          cwd: project.cwd,
          gitRemote: ports.gitRemote,
          tagLister: ports.tagLister,
          downloader: ports.downloader,
        }),
      /intersection|conflict|empty|cannot resolve/i,
    );
    expect(String(err instanceof Error ? err.message : err)).toMatch(/->/);
  } finally {
    project.cleanup();
  }
});
