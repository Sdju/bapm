/**
 * Default downloader against a real local git repository: resolve and install
 * both download into the same modules dest, so a second download must succeed.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDefaultDownloader } from "../../src/index.ts";

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@example.com",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@example.com",
    },
  }).trim();
}

describe("default downloader idempotency", () => {
  let root: string | undefined;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  function workRoot(): string {
    root ??= mkdtempSync(join(tmpdir(), "bapm-downloader-"));
    return root;
  }

  function makeRepo(
    name = "repo",
    prefix = "",
  ): { repoUrl: string; first: string; second: string } {
    const repo = join(workRoot(), name);
    mkdirSync(repo);
    git(repo, "init", "-q");
    writeFileSync(join(repo, "file.txt"), `${prefix}v1\n`);
    git(repo, "add", "-A");
    git(repo, "commit", "-qm", "one");
    const first = git(repo, "rev-parse", "HEAD");
    writeFileSync(join(repo, "file.txt"), `${prefix}v2\n`);
    git(repo, "commit", "-qam", "two");
    const second = git(repo, "rev-parse", "HEAD");
    return { repoUrl: repo, first, second };
  }

  test("second download into the same dest succeeds", async () => {
    const { repoUrl, first } = makeRepo();
    const dest = join(root!, "apm_modules", "pkg", first.slice(0, 12));
    const downloader = createDefaultDownloader();

    await downloader.download({ repoUrl, commit: first, dest, identity: "pkg" });
    await downloader.download({ repoUrl, commit: first, dest, identity: "pkg" });

    expect(readFileSync(join(dest, "file.txt"), "utf8")).toBe("v1\n");
    expect(git(dest, "rev-parse", "HEAD")).toBe(first);
  });

  test("dest with other content is replaced by a checkout at the commit", async () => {
    const { repoUrl, second } = makeRepo();
    const dest = join(root!, "apm_modules", "pkg", second.slice(0, 12));
    mkdirSync(dest, { recursive: true });
    writeFileSync(join(dest, "junk.txt"), "partial\n");
    const downloader = createDefaultDownloader();

    await downloader.download({ repoUrl, commit: second, dest, identity: "pkg" });

    expect(existsSync(join(dest, "junk.txt"))).toBe(false);
    expect(readFileSync(join(dest, "file.txt"), "utf8")).toBe("v2\n");
    expect(git(dest, "rev-parse", "HEAD")).toBe(second);
  });

  test("checkout at another commit is moved to the requested one", async () => {
    const { repoUrl, first, second } = makeRepo();
    const dest = join(root!, "apm_modules", "pkg", "shared");
    const downloader = createDefaultDownloader();

    await downloader.download({ repoUrl, commit: second, dest, identity: "pkg" });
    await downloader.download({ repoUrl, commit: first, dest, identity: "pkg" });

    expect(git(dest, "rev-parse", "HEAD")).toBe(first);
  });

  test("undefined commit reuses a valid checkout of the same repo", async () => {
    const { repoUrl, first } = makeRepo();
    const dest = join(root!, "apm_modules", "pkg", "unpinned");
    const downloader = createDefaultDownloader();

    await downloader.download({ repoUrl, commit: first, dest, identity: "pkg" });
    writeFileSync(join(dest, "reused-marker.txt"), "kept\n");

    await downloader.download({ repoUrl, dest, identity: "pkg" });

    expect(existsSync(join(dest, "reused-marker.txt"))).toBe(true);
    expect(git(dest, "rev-parse", "HEAD")).toBe(first);
  });

  test("undefined commit replaces a checkout of a different repo at the same dest", async () => {
    const firstRepo = makeRepo("repo-a", "a-");
    const otherRepo = makeRepo("repo-b", "b-");
    const dest = join(root!, "apm_modules", "pkg", "unpinned");
    const downloader = createDefaultDownloader();

    await downloader.download({ repoUrl: firstRepo.repoUrl, dest, identity: "pkg" });
    writeFileSync(join(dest, "reused-marker.txt"), "should disappear\n");

    await downloader.download({ repoUrl: otherRepo.repoUrl, dest, identity: "pkg" });

    expect(existsSync(join(dest, "reused-marker.txt"))).toBe(false);
    expect(git(dest, "config", "--get", "remote.origin.url")).toBe(otherRepo.repoUrl);
    expect(readFileSync(join(dest, "file.txt"), "utf8")).toBe("b-v2\n");
  });

  test("abbreviated SHA reuses an existing full-SHA checkout", async () => {
    const { repoUrl, first } = makeRepo();
    const dest = join(root!, "apm_modules", "pkg", "abbrev");
    const downloader = createDefaultDownloader();

    await downloader.download({ repoUrl, commit: first, dest, identity: "pkg" });
    writeFileSync(join(dest, "reused-marker.txt"), "kept\n");

    await downloader.download({ repoUrl, commit: first.slice(0, 7), dest, identity: "pkg" });

    expect(existsSync(join(dest, "reused-marker.txt"))).toBe(true);
    expect(git(dest, "rev-parse", "HEAD")).toBe(first);
  });

  test("dirty tracked worktree at the right HEAD is replaced with a clean tree", async () => {
    const { repoUrl, second } = makeRepo();
    const dest = join(root!, "apm_modules", "pkg", "dirty");
    const downloader = createDefaultDownloader();

    await downloader.download({ repoUrl, commit: second, dest, identity: "pkg" });
    writeFileSync(join(dest, "file.txt"), "local edit\n");
    expect(git(dest, "status", "--porcelain", "--untracked-files=no")).not.toBe("");

    await downloader.download({ repoUrl, commit: second, dest, identity: "pkg" });

    expect(readFileSync(join(dest, "file.txt"), "utf8")).toBe("v2\n");
    expect(git(dest, "status", "--porcelain", "--untracked-files=no")).toBe("");
  });

  test("failed status probe makes the checkout non-reusable", async () => {
    const { repoUrl, second } = makeRepo();
    const dest = join(root!, "apm_modules", "pkg", "broken-index");
    const downloader = createDefaultDownloader();

    await downloader.download({ repoUrl, commit: second, dest, identity: "pkg" });
    writeFileSync(join(dest, "reused-marker.txt"), "should disappear\n");
    // Make `git status` exit non-zero: an index path that is not a file makes
    // the probe fail (akin to an unreadable/dubious repository).
    rmSync(join(dest, ".git", "index"));
    mkdirSync(join(dest, ".git", "index"));
    expect(() => git(dest, "status", "--porcelain", "--untracked-files=no")).toThrow();

    await downloader.download({ repoUrl, commit: second, dest, identity: "pkg" });

    expect(existsSync(join(dest, "reused-marker.txt"))).toBe(false);
    expect(git(dest, "rev-parse", "HEAD")).toBe(second);
    expect(git(dest, "status", "--porcelain", "--untracked-files=no")).toBe("");
  });

  // Backup-cleanup failure is best effort and not practical to trigger here; the
  // implementation swallows it so an already-installed tree is never failed.
  test("concurrent downloads into the same dest both succeed", async () => {
    const { repoUrl, second } = makeRepo();
    const dest = join(root!, "apm_modules", "pkg", "concurrent");
    const downloader = createDefaultDownloader();

    await Promise.all([
      downloader.download({ repoUrl, commit: second, dest, identity: "pkg" }),
      downloader.download({ repoUrl, commit: second, dest, identity: "pkg" }),
    ]);

    expect(git(dest, "rev-parse", "HEAD")).toBe(second);
    expect(readFileSync(join(dest, "file.txt"), "utf8")).toBe("v2\n");
    expect(git(dest, "status", "--porcelain", "--untracked-files=no")).toBe("");
    expect(readdirSync(join(root!, "apm_modules", "pkg")).some((n) => n.includes(".tmp-"))).toBe(
      false,
    );
  });

  test("repoUrl plus path clones the repo instead of treating path as local", async () => {
    const { repoUrl, second } = makeRepo();
    const dest = join(root!, "apm_modules", "pkg", "virtual");
    const downloader = createDefaultDownloader();

    await downloader.download({
      repoUrl,
      path: join(root!, "not-a-local-source"),
      commit: second,
      dest,
      identity: "pkg",
    });

    expect(readFileSync(join(dest, "file.txt"), "utf8")).toBe("v2\n");
    expect(git(dest, "rev-parse", "HEAD")).toBe(second);
  });

  test("failed clone leaves a pre-existing dest intact", async () => {
    const { repoUrl, first } = makeRepo();
    const dest = join(root!, "apm_modules", "pkg", "cached");
    const downloader = createDefaultDownloader();

    await downloader.download({ repoUrl, commit: first, dest, identity: "pkg" });
    writeFileSync(join(dest, "reused-marker.txt"), "kept\n");
    const missingRepo = join(root!, "does-not-exist");

    await expect(
      downloader.download({ repoUrl: missingRepo, commit: first, dest, identity: "pkg" }),
    ).rejects.toThrow();

    expect(existsSync(join(dest, "reused-marker.txt"))).toBe(true);
    expect(readFileSync(join(dest, "file.txt"), "utf8")).toBe("v1\n");
    expect(git(dest, "rev-parse", "HEAD")).toBe(first);
    expect(readdirSync(join(root!, "apm_modules", "pkg")).some((n) => n.includes(".tmp-"))).toBe(
      false,
    );
  });
});
