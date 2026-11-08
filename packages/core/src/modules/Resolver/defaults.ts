import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildGitChildEnv, hostnameFromUrlOrHost } from "@/modules/Auth";
import {
  isCacheableGitRepoUrl,
  materializeSharedGitCheckout,
  resolveSharedGitCacheConfig,
} from "@/modules/SharedCache";
import type { Downloader, GitRemote, TagLister } from "./types.ts";
import { identityToCacheDir, normalizeRepoIdentity } from "./identity.ts";
import { APM_MODULES_DIR } from "./constants.ts";
import { materializeLocalFileSnapshot } from "./localFile.ts";

export type DefaultDownloaderOptions = {
  /** Warning sink for shared-cache fallback messages (default: stderr). */
  warn?: (message: string) => void;
  /** Env used for shared-cache gating (default: `process.env`). */
  env?: NodeJS.ProcessEnv;
  /** Explicit shared cache root; overrides `BAPM_CACHE_DIR`. */
  cacheDir?: string;
  /** Explicit disable; overrides `BAPM_NO_CACHE`. */
  noCache?: boolean;
};

/**
 * Default TagLister via `git ls-remote --tags --refs`.
 * Omits peeled `^{}` lines — used by resolve / constraint paths (stable).
 */
export function createDefaultTagLister(): TagLister {
  return {
    async listTags(repoUrl: string) {
      const out = await runGit(["ls-remote", "--tags", "--refs", repoUrl]);
      const tags: Array<{ tag: string; commit: string }> = [];
      for (const line of out.split("\n")) {
        const m = line.match(/^([0-9a-f]{40})\s+refs\/tags\/(.+)$/i);
        if (m) tags.push({ commit: m[1]!.toLowerCase(), tag: m[2]! });
      }
      return tags;
    },
  };
}

/**
 * Peel-aware TagLister for Outdated full-SHA revision-pin path.
 * `git ls-remote --tags` (no `--refs`); pairs `refs/tags/X^{}` → annotated.
 */
export function createPeelAwareTagLister(): TagLister {
  return {
    async listTags(repoUrl: string) {
      const out = await runGit(["ls-remote", "--tags", repoUrl]);
      return parseLsRemoteTagsWithPeel(out);
    },
  };
}

/**
 * Parse `git ls-remote --tags` output; annotated = presence of peeled `^{}` line.
 * Commit for annotated tags is the peeled SHA (APM fence).
 */
export function parseLsRemoteTagsWithPeel(output: string): Array<{
  tag: string;
  commit: string;
  annotated: boolean;
}> {
  const tags = new Map<string, string>();
  const annotated = new Set<string>();

  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^([0-9a-f]{40})\s+refs\/tags\/(.+)$/i);
    if (!m) continue;
    const sha = m[1]!.toLowerCase();
    let name = m[2]!;
    if (name.endsWith("^{}")) {
      name = name.slice(0, -3);
      tags.set(name, sha);
      annotated.add(name);
    } else if (!tags.has(name)) {
      tags.set(name, sha);
    }
  }

  return [...tags.entries()].map(([tag, commit]) => ({
    tag,
    commit,
    annotated: annotated.has(tag),
  }));
}

/** Default GitRemote via `git ls-remote`. */
export function createDefaultGitRemote(): GitRemote {
  return {
    async resolveRef(repoUrl: string, ref: string) {
      if (/^[0-9a-f]{40}$/i.test(ref)) return ref.toLowerCase();
      const out = await runGit(["ls-remote", repoUrl, ref]);
      const line = out.split("\n").find((l) => l.trim().length > 0);
      if (!line) {
        // try refs/heads and refs/tags
        const out2 = await runGit(["ls-remote", repoUrl, `refs/heads/${ref}`, `refs/tags/${ref}`]);
        const line2 = out2.split("\n").find((l) => l.trim().length > 0);
        if (!line2) throw new Error(`Unable to resolve ref ${ref} for ${repoUrl}`);
        return line2.split(/\s+/)[0]!.toLowerCase();
      }
      return line.split(/\s+/)[0]!.toLowerCase();
    },
  };
}

/** Default Downloader: local copy or git clone into apm_modules. */
export function createDefaultDownloader(options: DefaultDownloaderOptions = {}): Downloader {
  const warn = options.warn ?? ((message: string) => console.error(`bapm: warning: ${message}`));

  return {
    async download(args) {
      // `path` is only a local source when there is no git source. With a
      // repoUrl it is the APM virtual subpath inside the clone.
      if (args.path && !args.repoUrl) {
        if (!existsSync(args.path)) {
          throw new Error(`Local path not found: ${args.path}`);
        }
        if (statSync(args.path).isFile()) {
          materializeLocalFileSnapshot(args.path, args.dest);
          return;
        }
        mkdirSync(args.dest, { recursive: true });
        cpSync(args.path, args.dest, { recursive: true });
        return;
      }
      if (!args.repoUrl) {
        throw new Error("download requires repoUrl or path");
      }
      // Resolve and install both download into the same dest; reuse a matching checkout.
      const repoUrl = args.repoUrl;
      if (await isCheckoutAt(args.dest, repoUrl, args.commit)) return;

      const parent = dirname(args.dest);
      mkdirSync(parent, { recursive: true });
      // Build the new checkout beside dest so a failed clone/checkout leaves the
      // previously usable cache untouched.
      const temp = mkdtempSync(join(parent, `.${basename(args.dest)}.tmp-`));
      try {
        let installedFromSharedCache = false;
        const sharedConfig = resolveSharedGitCacheConfig({
          env: options.env,
          cacheDir: options.cacheDir,
          noCache: options.noCache,
        });
        if (sharedConfig.enabled && isCacheableGitRepoUrl(repoUrl)) {
          try {
            await materializeSharedGitCheckout({
              config: sharedConfig,
              repoUrl,
              identity: normalizeRepoIdentity(repoUrl),
              commit: args.commit,
              dest: temp,
              env: options.env,
              warn,
            });
            installedFromSharedCache = true;
          } catch (error) {
            warn(
              `shared git cache unavailable for ${repoUrl}: ${errorMessage(error)}; ` +
                "falling back to direct clone",
            );
            resetEmptyDir(temp);
          }
        }

        if (!installedFromSharedCache) {
          await runGit(["clone", "--quiet", repoUrl, temp], { allowFail: false });
          if (args.commit) {
            await runGit(["-C", temp, "checkout", "--quiet", args.commit]);
          }
        }
        await swapIntoPlace(temp, args.dest, () => isCheckoutAt(args.dest, repoUrl, args.commit));
      } finally {
        // Absent after a successful rename; best-effort removal otherwise.
        try {
          rmSync(temp, { recursive: true, force: true });
        } catch {
          // A leftover temp dir is harmless: later runs use a fresh mkdtemp path.
        }
      }
    },
  };
}

/**
 * Idempotency guard: dest must be a checkout of the requested repo, resolved at
 * the requested commit (when given), with no modified tracked files.
 */
async function isCheckoutAt(
  dest: string,
  repoUrl: string,
  commit: string | undefined,
): Promise<boolean> {
  if (!existsSync(join(dest, ".git"))) return false;

  const remote = await runGit(["-C", dest, "config", "--get", "remote.origin.url"], {
    allowFail: true,
  });
  if (!isSameRepo(remote.trim(), repoUrl)) return false;

  const head = (
    await runGit(["-C", dest, "rev-parse", "--verify", "HEAD^{commit}"], { allowFail: true })
  )
    .trim()
    .toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(head)) return false;

  if (commit) {
    // Accept short SHAs / tags / refs already present in dest before comparing.
    const requested = (
      await runGit(["-C", dest, "rev-parse", "--verify", `${commit}^{commit}`], { allowFail: true })
    )
      .trim()
      .toLowerCase();
    if (!/^[0-9a-f]{40}$/.test(requested) || requested !== head) return false;
  }

  const status = await runGitResult(["-C", dest, "status", "--porcelain", "--untracked-files=no"]);
  // Fail closed: a probe failure is not the same as clean output.
  return status.code === 0 && status.stdout.trim() === "";
}

/** Compare git URLs; local paths/file URLs are resolved, remotes normalized. */
function isSameRepo(a: string, b: string): boolean {
  const left = canonicalRepoRef(a);
  const right = canonicalRepoRef(b);
  if (!left || !right) return false;
  if (process.platform === "win32") return left.toLowerCase() === right.toLowerCase();
  return left === right;
}

function canonicalRepoRef(url: string): string | undefined {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!trimmed) return undefined;
  if (/^file:\/\//i.test(trimmed)) {
    try {
      return resolve(fileURLToPath(trimmed));
    } catch {
      return normalizeRepoIdentity(trimmed);
    }
  }
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../") ||
    trimmed.startsWith("\\\\") ||
    /^[A-Za-z]:[\\/]/.test(trimmed)
  ) {
    return resolve(trimmed);
  }
  return normalizeRepoIdentity(trimmed);
}

/**
 * Replace dest with temp, keeping dest intact if the swap itself fails.
 * Concurrent downloads may install a valid checkout first; accept that tree
 * rather than failing the losing download.
 */
async function swapIntoPlace(
  temp: string,
  dest: string,
  isReusable: () => Promise<boolean>,
): Promise<void> {
  const backup = `${temp}.old`;
  try {
    renameSync(temp, dest);
    return;
  } catch (error) {
    // Rename onto a non-empty directory fails; the same tree may already be
    // installed by a concurrent download.
    if (!isOccupiedTargetError(error) || !existsSync(dest)) throw error;
  }

  if (await isReusable()) return;

  try {
    // Renaming a symlink moves the link itself, never its target.
    renameSync(dest, backup);
  } catch (error) {
    if (!isMissingTargetError(error)) throw error;
    // A concurrent download moved dest away after our check; retry once.
    try {
      renameSync(temp, dest);
      return;
    } catch (retryError) {
      if (isOccupiedTargetError(retryError) && (await isReusable())) return;
      throw retryError;
    }
  }

  try {
    renameSync(temp, dest);
  } catch (error) {
    if (isOccupiedTargetError(error) && (await isReusable())) {
      removeBestEffort(backup);
      return;
    }
    try {
      renameSync(backup, dest);
    } catch (restoreError) {
      throw combinedSwapError(error, restoreError, backup);
    }
    throw error;
  }
  removeBestEffort(backup);
}

function isOccupiedTargetError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  // ENOTEMPTY/EEXIST: non-empty/occupied dest. EPERM: Windows rename-over.
  // ENOTDIR/EISDIR: dest exists but is a file/symlink rather than a directory.
  return (
    code === "ENOTEMPTY" ||
    code === "EEXIST" ||
    code === "EPERM" ||
    code === "ENOTDIR" ||
    code === "EISDIR"
  );
}

function isMissingTargetError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
}

function removeBestEffort(path: string): void {
  try {
    rmSync(path, { recursive: true, force: true });
  } catch {
    // The new tree is already in place. A leftover unique backup path is
    // harmless and must not fail the download.
  }
}

function combinedSwapError(original: unknown, restore: unknown, backup: string): Error {
  return new Error(
    `failed to install checkout: ${errorMessage(original)}; ` +
      `also failed to restore previous checkout from ${backup}: ${errorMessage(restore)}`,
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Clear a mkdtemp path after a failed attempt so a fallback clone can reuse it. */
function resetEmptyDir(path: string): void {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
}

export function modulesCacheDest(cwd: string, identity: string, commit?: string): string {
  const base = join(cwd, APM_MODULES_DIR, identityToCacheDir(identity));
  if (commit) return join(base, commit.slice(0, 12));
  return base;
}

export function ensureModulesRoot(cwd: string): string {
  const root = join(cwd, APM_MODULES_DIR);
  mkdirSync(root, { recursive: true });
  return root;
}

function gitUrlFromArgs(args: string[]): string | undefined {
  // Prefer last https?/git URL-like arg (clone / ls-remote).
  for (let i = args.length - 1; i >= 0; i -= 1) {
    const a = args[i]!;
    if (/^(https?:|git@)/i.test(a) || /^[^@\s]+\/[^@\s]+$/.test(a)) return a;
  }
  return undefined;
}

type GitResult = { code: number; stdout: string; stderr: string };

async function runGitResult(args: string[]): Promise<GitResult> {
  const url = gitUrlFromArgs(args);
  const host = url ? hostnameFromUrlOrHost(url) : undefined;
  const env =
    host && url
      ? buildGitChildEnv({ host, url, env: process.env })
      : buildGitChildEnv({
          host: "localhost",
          url: url ?? "https://localhost/",
          env: process.env,
        });
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (c: Buffer) => {
      stdout += c.toString();
    });
    child.stderr?.on("data", (c: Buffer) => {
      stderr += c.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function runGit(args: string[], options?: { allowFail?: boolean }): Promise<string> {
  const result = await runGitResult(args);
  if (result.code !== 0 && options?.allowFail !== true) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

export { normalizeRepoIdentity };
