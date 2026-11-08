import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { buildGitChildEnv, hostnameFromUrlOrHost } from "@/modules/Auth";
import type {
  SharedCacheEnv,
  SharedGitCacheCleanOptions,
  SharedGitCacheCleanResult,
  SharedGitCacheConfig,
  SharedGitCacheInfoOptions,
  SharedGitCacheInfoResult,
  SharedGitMirrorEntry,
} from "./types.ts";

export const BAPM_CACHE_DIR_ENV = "BAPM_CACHE_DIR";
export const BAPM_NO_CACHE_ENV = "BAPM_NO_CACHE";
export const SHARED_GIT_CACHE_SUBDIR = "git";

/**
 * Resolve env-only shared cache configuration. Default off: no cache dir means
 * `enabled: false`, and `BAPM_NO_CACHE` wins over a configured directory.
 */
export function resolveSharedGitCacheConfig(
  options: {
    env?: SharedCacheEnv;
    cacheDir?: string;
    noCache?: boolean;
  } = {},
): SharedGitCacheConfig {
  const env = options.env ?? process.env;
  const rawDir = (options.cacheDir ?? env[BAPM_CACHE_DIR_ENV])?.trim();
  const noCache = options.noCache ?? envFlag(env[BAPM_NO_CACHE_ENV]);

  if (!rawDir) {
    return {
      enabled: false,
      disabledByNoCache: noCache,
      reason: "env-unset",
    };
  }

  const cacheDir = resolve(rawDir);
  const gitDir = join(cacheDir, SHARED_GIT_CACHE_SUBDIR);
  if (noCache) {
    return {
      enabled: false,
      cacheDir,
      gitDir,
      disabledByNoCache: true,
      reason: "no-cache",
    };
  }

  return {
    enabled: true,
    cacheDir,
    gitDir,
    disabledByNoCache: false,
    reason: "enabled",
  };
}

/**
 * Only real git remotes are cacheable. Local paths, `file://`, and bapm
 * `local:` sources must never populate the shared cache.
 */
export function isCacheableGitRepoUrl(repoUrl: string | undefined): boolean {
  if (!repoUrl) return false;
  const trimmed = repoUrl.trim();
  if (!trimmed) return false;
  if (isLocalSourceRef(trimmed)) return false;
  return /^(?:https?|git|ssh|git\+https?):\/\//i.test(trimmed) || /^git@[^:\s]+:.+$/.test(trimmed);
}

export function sharedGitMirrorName(identity: string): string {
  return `${createHash("sha256").update(identity).digest("hex")}.git`;
}

/**
 * Ensure a bare mirror for `repoUrl` exists under `<cacheDir>/git` and is
 * up to date. The mirror path is keyed by the normalized repo identity, so
 * distinct refs/commits share one mirror.
 *
 * When an update fails but the mirror already contains the requested commit,
 * the stale mirror is used (offline-friendly) and a warning is emitted.
 */
export async function ensureSharedGitMirror(args: {
  config: SharedGitCacheConfig;
  repoUrl: string;
  identity: string;
  commit?: string;
  env?: SharedCacheEnv;
  warn?: (message: string) => void;
}): Promise<string> {
  const gitDir = args.config.gitDir;
  if (!args.config.enabled || !gitDir) {
    throw new Error("shared git cache is disabled");
  }

  mkdirSync(gitDir, { recursive: true });
  const mirror = join(gitDir, sharedGitMirrorName(args.identity));

  if (await isValidBareMirror(mirror, args.repoUrl, args.env)) {
    const update = await runGit(["--git-dir", mirror, "remote", "update", "--prune"], {
      credentialUrl: args.repoUrl,
      env: args.env,
    });
    if (update.code !== 0) {
      const detail = firstLine(update.stderr || update.stdout) || "unknown git error";
      if (!args.commit || (await hasCommit(mirror, args.commit, args.env))) {
        args.warn?.(
          `update failed for ${args.repoUrl} (${detail}); using existing mirror ${mirror}`,
        );
        return mirror;
      }
      throw new Error(
        `mirror update failed and requested commit ${args.commit} is absent: ${detail}`,
      );
    }
    return mirror;
  }

  // Missing or corrupted mirror: clone into a unique sibling, then swap into
  // place atomically so a concurrent reader never observes a partial mirror.
  const temp = mkdtempSync(join(gitDir, `.${basename(mirror)}.tmp-`));
  try {
    const clone = await runGit(["clone", "--mirror", "--quiet", args.repoUrl, temp], {
      credentialUrl: args.repoUrl,
      env: args.env,
    });
    if (clone.code !== 0) {
      throw new Error(
        `mirror clone failed: ${firstLine(clone.stderr || clone.stdout) || "unknown git error"}`,
      );
    }
    if (!(await isValidBareMirror(temp, args.repoUrl, args.env))) {
      throw new Error("mirror clone did not produce a bare repository");
    }
    await installMirror(temp, mirror, args.repoUrl, args.env);
    return mirror;
  } finally {
    // Absent after a successful rename; harmless if the rename lost a race.
    removeBestEffort(temp);
  }
}

/**
 * Materialize a checkout from the shared mirror into an existing empty `dest`
 * directory. Uses a local clone (hardlinks where possible) so the materialized
 * tree stays self-contained when the shared cache is later cleaned.
 */
export async function materializeSharedGitCheckout(args: {
  config: SharedGitCacheConfig;
  repoUrl: string;
  identity: string;
  commit?: string;
  dest: string;
  env?: SharedCacheEnv;
  warn?: (message: string) => void;
}): Promise<{ mirror: string }> {
  if (existsSync(args.dest) && readdirSync(args.dest).length > 0) {
    throw new Error(`shared cache checkout destination is not empty: ${args.dest}`);
  }
  mkdirSync(args.dest, { recursive: true });

  const mirror = await ensureSharedGitMirror(args);

  const clone = await runGit(["clone", "--quiet", mirror, args.dest], {
    credentialUrl: args.repoUrl,
    env: args.env,
  });
  if (clone.code !== 0) {
    throw new Error(
      `clone from mirror failed: ${firstLine(clone.stderr || clone.stdout) || "unknown git error"}`,
    );
  }

  if (args.commit) {
    const checkout = await runGit(["-C", args.dest, "checkout", "--quiet", args.commit], {
      credentialUrl: args.repoUrl,
      env: args.env,
    });
    if (checkout.code !== 0) {
      throw new Error(
        `checkout of ${args.commit} from mirror failed: ` +
          `${firstLine(checkout.stderr || checkout.stdout) || "unknown git error"}`,
      );
    }
  }

  // Preserve the manifest URL on the checkout; direct clone sets this too, and
  // the idempotency probe compares it. The mirror path is an implementation
  // detail and must not leak into apm_modules remotes.
  const setUrl = await runGit(["-C", args.dest, "remote", "set-url", "origin", args.repoUrl], {
    credentialUrl: args.repoUrl,
    env: args.env,
  });
  if (setUrl.code !== 0) {
    throw new Error(
      `failed to set checkout origin: ${firstLine(setUrl.stderr || setUrl.stdout) || "unknown git error"}`,
    );
  }

  return { mirror };
}

/** Shared git-cache root/path + size stats. Safe to call when disabled. */
export function sharedGitCacheInfo(
  options: SharedGitCacheInfoOptions = {},
): SharedGitCacheInfoResult {
  const config = resolveSharedGitCacheConfig(options);
  const gitDir = config.gitDir;
  const exists = Boolean(gitDir && existsSync(gitDir) && statSync(gitDir).isDirectory());

  let mirrors = 0;
  let sizeBytes = 0;
  const mirrorPaths: string[] = [];
  const entries: SharedGitMirrorEntry[] = [];

  if (gitDir && exists) {
    for (const name of readdirSync(gitDir)) {
      if (name === "." || name === "..") continue;
      const path = join(gitDir, name);
      try {
        if (!statSync(path).isDirectory()) continue;
      } catch {
        continue;
      }
      const size = dirSize(path);
      mirrors += 1;
      sizeBytes += size;
      mirrorPaths.push(path);
      entries.push({ name, path, sizeBytes: size });
    }
  }

  const empty = mirrors === 0;
  const lines: string[] = [];
  if (config.reason === "env-unset") {
    lines.push("shared git cache: disabled (set BAPM_CACHE_DIR to enable)");
  } else if (config.reason === "no-cache") {
    lines.push("shared git cache: disabled by BAPM_NO_CACHE");
    if (gitDir) lines.push(`cache root: ${gitDir}`);
  } else if (!exists) {
    lines.push(`shared git cache: ${gitDir} (absent/empty)`);
    lines.push("mirrors: 0");
    lines.push("size: 0 bytes");
  } else if (empty) {
    lines.push(`shared git cache: ${gitDir}`);
    lines.push("mirrors: 0");
    lines.push("size: 0 bytes");
    lines.push("status: empty");
  } else {
    lines.push(`shared git cache: ${gitDir}`);
    lines.push(`mirrors: ${mirrors}`);
    lines.push(`size: ${sizeBytes} bytes`);
    lines.push("bare mirrors keyed by sha256(normalized repo url)");
  }

  return {
    enabled: config.enabled,
    cacheDir: config.cacheDir,
    gitDir,
    reason: config.reason,
    disabledByNoCache: config.disabledByNoCache,
    exists,
    mirrors,
    entries: mirrors,
    sizeBytes,
    empty,
    mirrorPaths,
    text: lines.join("\n"),
  };
}

/**
 * Remove shared git mirrors only. Never touches `<cwd>/apm_modules`; the
 * project modules-cache clean path remains `cacheClean`.
 */
export function sharedGitCacheClean(
  options: SharedGitCacheCleanOptions = {},
): SharedGitCacheCleanResult {
  const config = resolveSharedGitCacheConfig(options);
  const gitDir = config.gitDir;
  if (!gitDir) {
    return {
      ok: true,
      cleaned: false,
      enabled: false,
      cacheDir: config.cacheDir,
      removedEntries: 0,
      message: "shared git cache: disabled (BAPM_CACHE_DIR unset); nothing to clean",
    };
  }

  const dryRun = options.dryRun === true;
  const yes = options.yes === true || options.y === true;
  const requireYes = options.requireYes !== false;
  const names = existsSync(gitDir)
    ? readdirSync(gitDir).filter((name) => name !== "." && name !== "..")
    : [];

  if (dryRun) {
    return {
      ok: true,
      cleaned: false,
      enabled: config.enabled,
      cacheDir: config.cacheDir,
      gitDir,
      removedEntries: names.length,
      message:
        names.length === 0
          ? `shared git cache clean dry-run: ${gitDir} empty (would remove 0); apm_modules untouched`
          : `shared git cache clean dry-run: would remove ${names.length} mirrors from ${gitDir} ` +
            `(${names.join(", ")}); apm_modules untouched`,
    };
  }

  if (!yes && requireYes) {
    return {
      ok: false,
      cleaned: false,
      enabled: config.enabled,
      cacheDir: config.cacheDir,
      gitDir,
      removedEntries: 0,
      refused: true,
      message:
        `shared git cache clean refused: require -y / --yes to delete mirrors at ${gitDir}; ` +
        "apm_modules is never removed by this command",
    };
  }

  for (const name of names) {
    rmSync(join(gitDir, name), { recursive: true, force: true });
  }

  return {
    ok: true,
    cleaned: true,
    enabled: config.enabled,
    cacheDir: config.cacheDir,
    gitDir,
    removedEntries: names.length,
    message:
      `shared git cache clean: removed ${names.length} mirrors from ${gitDir}; ` +
      "apm_modules untouched",
  };
}

async function isValidBareMirror(
  path: string,
  credentialUrl: string,
  env: SharedCacheEnv | undefined,
): Promise<boolean> {
  if (!existsSync(path) || !statSync(path).isDirectory()) return false;
  const result = await runGit(["--git-dir", path, "rev-parse", "--is-bare-repository"], {
    credentialUrl,
    env,
  });
  return result.code === 0 && result.stdout.trim() === "true";
}

async function hasCommit(
  mirror: string,
  commit: string,
  env: SharedCacheEnv | undefined,
): Promise<boolean> {
  const result = await runGit(["--git-dir", mirror, "cat-file", "-e", `${commit}^{commit}`], {
    credentialUrl: undefined,
    env,
  });
  return result.code === 0;
}

async function installMirror(
  temp: string,
  mirror: string,
  credentialUrl: string,
  env: SharedCacheEnv | undefined,
): Promise<void> {
  try {
    renameSync(temp, mirror);
    return;
  } catch (error) {
    if (!isOccupiedTargetError(error) || !existsSync(mirror)) throw error;
  }

  // A concurrent downloader installed a valid mirror first; adopt it.
  if (await isValidBareMirror(mirror, credentialUrl, env)) return;

  const backup = `${mirror}.old-${process.pid}-${Date.now()}`;
  renameSync(mirror, backup);
  try {
    renameSync(temp, mirror);
  } catch (error) {
    try {
      renameSync(backup, mirror);
    } catch {
      // Leave the unique backup in place rather than losing both trees.
    }
    throw error;
  }
  removeBestEffort(backup);
}

function isOccupiedTargetError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return (
    code === "ENOTEMPTY" ||
    code === "EEXIST" ||
    code === "EPERM" ||
    code === "ENOTDIR" ||
    code === "EISDIR"
  );
}

function removeBestEffort(path: string): void {
  try {
    rmSync(path, { recursive: true, force: true });
  } catch {
    // A leftover unique temp/backup directory is harmless.
  }
}

function dirSize(path: string): number {
  try {
    const st = statSync(path);
    if (st.isFile()) return st.size;
    if (!st.isDirectory()) return 0;
    let total = 0;
    for (const name of readdirSync(path)) {
      total += dirSize(join(path, name));
    }
    return total;
  } catch {
    return 0;
  }
}

function envFlag(value: string | undefined): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !/^(?:0|false|no|off)$/i.test(trimmed);
}

function isLocalSourceRef(value: string): boolean {
  return (
    value.startsWith("local:") ||
    /^file:\/\//i.test(value) ||
    value.startsWith("/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith("~/") ||
    value.startsWith(".\\") ||
    value.startsWith("..\\") ||
    value.startsWith("~\\") ||
    /^[A-Za-z]:[\\/]/.test(value)
  );
}

function firstLine(value: string): string {
  return (
    value
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0)
      ?.slice(0, 300) ?? ""
  );
}

type GitResult = { code: number; stdout: string; stderr: string };

async function runGit(
  args: string[],
  options: { credentialUrl?: string; env?: SharedCacheEnv } = {},
): Promise<GitResult> {
  const url = options.credentialUrl;
  const host = url ? hostnameFromUrlOrHost(url) : undefined;
  const parentEnv = options.env ?? process.env;
  const env =
    host && url
      ? buildGitChildEnv({ host, url, env: parentEnv })
      : buildGitChildEnv({
          host: "localhost",
          url: "https://localhost/",
          env: parentEnv,
        });

  return new Promise((resolvePromise, reject) => {
    const child = spawn("git", args, {
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolvePromise({ code: code ?? 1, stdout, stderr });
    });
  });
}
