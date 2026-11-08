/**
 * Opt-in shared git mirror cache in the default downloader.
 *
 * Local file remotes are reached through a git `insteadOf` rewrite so the
 * downloader sees a real https git URL (file:// sources are never cached).
 */
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
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
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import {
  BAPM_CACHE_DIR_ENV,
  BAPM_NO_CACHE_ENV,
  createDefaultDownloader,
  isCacheableGitRepoUrl,
  normalizeRepoIdentity,
  resolveAndLock,
  sharedGitCacheClean,
  sharedGitCacheInfo,
  sharedGitMirrorName,
} from "@b-apm/core";

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

describe("shared git cache downloader", () => {
  let root: string;
  let savedEnv: Record<string, string | undefined>;
  const fakeUrl = "https://bapm-cache.test/remote.git";

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "bapm-shared-cache-"));
    savedEnv = {
      [BAPM_CACHE_DIR_ENV]: process.env[BAPM_CACHE_DIR_ENV],
      [BAPM_NO_CACHE_ENV]: process.env[BAPM_NO_CACHE_ENV],
      GIT_CONFIG_GLOBAL: process.env.GIT_CONFIG_GLOBAL,
    };
    delete process.env[BAPM_CACHE_DIR_ENV];
    delete process.env[BAPM_NO_CACHE_ENV];
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(root, { recursive: true, force: true });
  });

  function cacheDir(): string {
    return join(root, "cache");
  }

  function makeRemote(prefix = ""): { repo: string; commit: string } {
    const repo = join(root, "remote");
    mkdirSync(repo, { recursive: true });
    git(repo, "init", "-q");
    writeFileSync(join(repo, "apm.yml"), `name: shared-cache-pkg\nversion: 0.0.1\n`);
    writeFileSync(join(repo, "file.txt"), `${prefix}v1\n`);
    git(repo, "add", "-A");
    git(repo, "commit", "-qm", "one");
    return { repo, commit: git(repo, "rev-parse", "HEAD") };
  }

  /** Make the https fake URL resolve to a local repository for git. */
  function enableInsteadOf(repo: string): string {
    const config = join(root, "gitconfig");
    execFileSync(
      "git",
      ["config", "--file", config, `url.${pathToFileURL(repo).href}.insteadOf`, fakeUrl],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    process.env.GIT_CONFIG_GLOBAL = config;
    return config;
  }

  function mirrorPath(url = fakeUrl): string {
    return join(cacheDir(), "git", sharedGitMirrorName(normalizeRepoIdentity(url)));
  }

  function findNamed(dir: string, name: string): string | undefined {
    if (!existsSync(dir)) return undefined;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = findNamed(path, name);
        if (found) return found;
      } else if (entry.name === name) {
        return path;
      }
    }
    return undefined;
  }

  test("first download populates a bare mirror and checks out the commit", async () => {
    const { repo, commit } = makeRemote();
    enableInsteadOf(repo);
    process.env[BAPM_CACHE_DIR_ENV] = cacheDir();
    const dest = join(root, "project-a", "apm_modules", "pkg", commit.slice(0, 12));

    await createDefaultDownloader().download({
      repoUrl: fakeUrl,
      commit,
      dest,
      identity: normalizeRepoIdentity(fakeUrl),
    });

    const mirror = mirrorPath();
    expect(existsSync(mirror)).toBe(true);
    expect(git(mirror, "rev-parse", "--is-bare-repository")).toBe("true");
    expect(readFileSync(join(dest, "file.txt"), "utf8")).toBe("v1\n");
    expect(git(dest, "rev-parse", "HEAD")).toBe(commit);
    expect(git(dest, "config", "--get", "remote.origin.url")).toBe(fakeUrl);
    expect(sharedGitCacheInfo().mirrors).toBe(1);
  });

  test("second project reuses the mirror when the upstream is gone (no direct clone)", async () => {
    const { repo, commit } = makeRemote();
    enableInsteadOf(repo);
    process.env[BAPM_CACHE_DIR_ENV] = cacheDir();
    const firstDest = join(root, "project-a", "apm_modules", "pkg");
    await createDefaultDownloader().download({
      repoUrl: fakeUrl,
      commit,
      dest: firstDest,
      identity: normalizeRepoIdentity(fakeUrl),
    });

    // Remove the upstream: only the mirror can satisfy the second project.
    rmSync(repo, { recursive: true, force: true });
    const warnings: string[] = [];
    const secondDest = join(root, "project-b", "apm_modules", "pkg");
    await createDefaultDownloader({ warn: (m) => warnings.push(m) }).download({
      repoUrl: fakeUrl,
      commit,
      dest: secondDest,
      identity: normalizeRepoIdentity(fakeUrl),
    });

    expect(readFileSync(join(secondDest, "file.txt"), "utf8")).toBe("v1\n");
    expect(git(secondDest, "rev-parse", "HEAD")).toBe(commit);
    expect(git(secondDest, "config", "--get", "remote.origin.url")).toBe(fakeUrl);
    expect(warnings.some((w) => /using existing mirror|update failed/i.test(w))).toBe(true);
    expect(readdirSync(join(cacheDir(), "git"))).toHaveLength(1);
  });

  test("BAPM_NO_CACHE=1 bypasses the shared cache even when BAPM_CACHE_DIR is set", async () => {
    const { repo, commit } = makeRemote();
    enableInsteadOf(repo);
    process.env[BAPM_CACHE_DIR_ENV] = cacheDir();
    process.env[BAPM_NO_CACHE_ENV] = "1";
    const dest = join(root, "project-no-cache", "apm_modules", "pkg");

    await createDefaultDownloader().download({
      repoUrl: fakeUrl,
      commit,
      dest,
      identity: normalizeRepoIdentity(fakeUrl),
    });

    expect(readFileSync(join(dest, "file.txt"), "utf8")).toBe("v1\n");
    expect(existsSync(join(cacheDir(), "git"))).toBe(false);
    const info = sharedGitCacheInfo();
    expect(info.enabled).toBe(false);
    expect(info.reason).toBe("no-cache");
  });

  test("unusable cache root warns and falls back to a direct clone", async () => {
    const { repo, commit } = makeRemote();
    enableInsteadOf(repo);
    mkdirSync(root, { recursive: true });
    process.env[BAPM_CACHE_DIR_ENV] = cacheDir();
    // A file where the mirror root must be makes mkdir fail, forcing fallback.
    mkdirSync(cacheDir(), { recursive: true });
    writeFileSync(join(cacheDir(), "git"), "not a directory\n");

    const warnings: string[] = [];
    const dest = join(root, "project-fallback", "apm_modules", "pkg");
    await createDefaultDownloader({ warn: (m) => warnings.push(m) }).download({
      repoUrl: fakeUrl,
      commit,
      dest,
      identity: normalizeRepoIdentity(fakeUrl),
    });

    expect(readFileSync(join(dest, "file.txt"), "utf8")).toBe("v1\n");
    expect(git(dest, "rev-parse", "HEAD")).toBe(commit);
    expect(warnings.some((w) => /falling back to direct clone/i.test(w))).toBe(true);
  });

  test("corrupted bare-mirror directory is recreated from upstream", async () => {
    const { repo, commit } = makeRemote();
    enableInsteadOf(repo);
    process.env[BAPM_CACHE_DIR_ENV] = cacheDir();
    const mirror = mirrorPath();
    mkdirSync(mirror, { recursive: true });
    writeFileSync(join(mirror, "HEAD"), "garbage\n");

    const dest = join(root, "project-repair", "apm_modules", "pkg");
    await createDefaultDownloader().download({
      repoUrl: fakeUrl,
      commit,
      dest,
      identity: normalizeRepoIdentity(fakeUrl),
    });

    expect(git(mirror, "rev-parse", "--is-bare-repository")).toBe("true");
    expect(git(dest, "rev-parse", "HEAD")).toBe(commit);
    expect(readFileSync(join(dest, "file.txt"), "utf8")).toBe("v1\n");
  });

  test("local path and file:// sources are never cached", async () => {
    const { repo, commit } = makeRemote();
    enableInsteadOf(repo);
    process.env[BAPM_CACHE_DIR_ENV] = cacheDir();
    const downloader = createDefaultDownloader();

    const pathDest = join(root, "project-local", "apm_modules", "pkg");
    await downloader.download({ repoUrl: repo, commit, dest: pathDest, identity: "pkg" });
    const fileDest = join(root, "project-file", "apm_modules", "pkg");
    await downloader.download({
      repoUrl: pathToFileURL(repo).href,
      commit,
      dest: fileDest,
      identity: "pkg-file",
    });

    expect(readFileSync(join(pathDest, "file.txt"), "utf8")).toBe("v1\n");
    expect(readFileSync(join(fileDest, "file.txt"), "utf8")).toBe("v1\n");
    expect(isCacheableGitRepoUrl(repo)).toBe(false);
    expect(isCacheableGitRepoUrl(pathToFileURL(repo).href)).toBe(false);
    expect(isCacheableGitRepoUrl("local:./pkg")).toBe(false);
    expect(isCacheableGitRepoUrl(fakeUrl)).toBe(true);
    expect(existsSync(join(cacheDir(), "git"))).toBe(false);
  });

  test("resolveAndLock populates the mirror and a warm second project reuses it offline", async () => {
    const { repo } = makeRemote();
    enableInsteadOf(repo);
    process.env[BAPM_CACHE_DIR_ENV] = cacheDir();

    const manifest = `name: shared-root\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: ${fakeUrl}\n`;
    const projectA = join(root, "resolve-a");
    mkdirSync(projectA, { recursive: true });
    writeFileSync(join(projectA, "bapm.yml"), manifest);

    await resolveAndLock({ cwd: projectA, downloader: createDefaultDownloader() });

    expect(existsSync(mirrorPath())).toBe(true);
    expect(findNamed(join(projectA, "apm_modules"), "file.txt")).toBeTruthy();

    // Warm replay from the copied lock plus the mirror must survive a missing
    // upstream (no direct clone possible).
    const projectB = join(root, "resolve-b");
    mkdirSync(projectB, { recursive: true });
    writeFileSync(join(projectB, "bapm.yml"), manifest);
    copyFileSync(join(projectA, "bapm.lock.yaml"), join(projectB, "bapm.lock.yaml"));
    rmSync(repo, { recursive: true, force: true });

    const warnings: string[] = [];
    await resolveAndLock({
      cwd: projectB,
      downloader: createDefaultDownloader({ warn: (m) => warnings.push(m) }),
    });

    const file = findNamed(join(projectB, "apm_modules"), "file.txt");
    expect(file).toBeTruthy();
    expect(readFileSync(file!, "utf8")).toBe("v1\n");
    expect(warnings.some((w) => /using existing mirror|update failed/i.test(w))).toBe(true);
  });

  test("shared clean only removes mirrors", async () => {
    const { repo, commit } = makeRemote();
    enableInsteadOf(repo);
    process.env[BAPM_CACHE_DIR_ENV] = cacheDir();
    const dest = join(root, "project-clean", "apm_modules", "pkg");
    await createDefaultDownloader().download({
      repoUrl: fakeUrl,
      commit,
      dest,
      identity: normalizeRepoIdentity(fakeUrl),
    });

    const projectModules = join(root, "project-clean", "apm_modules", "keep");
    mkdirSync(projectModules, { recursive: true });
    writeFileSync(join(projectModules, "marker"), "kept\n");

    const dry = sharedGitCacheClean({ dryRun: true });
    expect(dry.removedEntries).toBe(1);
    expect(existsSync(mirrorPath())).toBe(true);

    const refused = sharedGitCacheClean({});
    expect(refused.refused).toBe(true);
    expect(existsSync(mirrorPath())).toBe(true);

    const cleaned = sharedGitCacheClean({ yes: true });
    expect(cleaned.ok).toBe(true);
    expect(cleaned.removedEntries).toBe(1);
    expect(existsSync(mirrorPath())).toBe(false);
    expect(existsSync(join(projectModules, "marker"))).toBe(true);
    expect(readFileSync(join(dest, "file.txt"), "utf8")).toBe("v1\n");
  });
});
