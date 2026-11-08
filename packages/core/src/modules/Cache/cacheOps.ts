import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { APM_MODULES_DIR } from "@/modules/Resolver";
import { sharedGitCacheInfo, sharedHttpCacheInfo } from "@/modules/SharedCache";
import type {
  CacheCleanOptions,
  CacheCleanResult,
  CacheInfoOptions,
  CacheInfoResult,
} from "./types.ts";

/**
 * Report modules-cache root + size/entry stats (project `apm_modules`).
 * Also exposes opt-in shared git-cache stats without changing modules-cache
 * keys or rs-016 identity isolation.
 */
export function cacheInfo(options: CacheInfoOptions = {}): CacheInfoResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  const cacheRoot = resolve(options.cacheRoot ?? join(cwd, APM_MODULES_DIR));
  const exists = existsSync(cacheRoot) && statSync(cacheRoot).isDirectory();

  let entries = 0;
  let sizeBytes = 0;
  if (exists) {
    const names = readdirSync(cacheRoot).filter((n) => n !== "." && n !== "..");
    entries = names.length;
    for (const name of names) {
      sizeBytes += dirSize(join(cacheRoot, name));
    }
  }

  const empty = !exists || entries === 0;
  const modulesText = empty
    ? `cache root: ${cacheRoot}\nentries: 0\nsize: 0 bytes\nstatus: empty`
    : `cache root: ${cacheRoot}\nentries: ${entries}\nsize: ${sizeBytes} bytes\nfiles/dirs under apm_modules`;

  // Keep pre-existing output byte-stable when the shared cache is off; append
  // the shared sections only when BAPM_CACHE_DIR configured one.
  const shared = sharedGitCacheInfo({ env: options.env });
  const sharedHttp = sharedHttpCacheInfo({ env: options.env });
  const text = shared.cacheDir
    ? `${modulesText}\n\n${shared.text}\n\n${sharedHttp.text}`
    : modulesText;

  return {
    cacheRoot,
    exists,
    entries,
    sizeBytes,
    empty,
    text,
    shared,
    sharedHttp,
  };
}

export const getCacheInfo = cacheInfo;
export const modulesCacheInfo = cacheInfo;

/**
 * Remove modules-cache content. Without `yes`/`-y`, refuses (non-silent).
 * With `dryRun`, previews would-remove count/names and never deletes.
 */
export function cacheClean(options: CacheCleanOptions = {}): CacheCleanResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  const cacheRoot = resolve(options.cacheRoot ?? join(cwd, APM_MODULES_DIR));
  const yes = options.yes === true || options.y === true;
  const requireYes = options.requireYes !== false;
  const dryRun = options.dryRun === true;

  if (dryRun) {
    if (!existsSync(cacheRoot)) {
      return {
        ok: true,
        cleaned: false,
        cacheRoot,
        removedEntries: 0,
        message: `cache clean dry-run: ${cacheRoot} absent (already empty, would remove 0)`,
      };
    }
    const names = readdirSync(cacheRoot).filter((n) => n !== "." && n !== "..");
    return {
      ok: true,
      cleaned: false,
      cacheRoot,
      removedEntries: names.length,
      message:
        names.length === 0
          ? `cache clean dry-run: ${cacheRoot} empty (would remove 0)`
          : `cache clean dry-run: would remove ${names.length} entries from ${cacheRoot} (${names.join(", ")})`,
    };
  }

  if (!yes && requireYes) {
    return {
      ok: false,
      cleaned: false,
      cacheRoot,
      removedEntries: 0,
      refused: true,
      message: `cache clean refused: require -y / --yes to delete modules cache at ${cacheRoot}`,
    };
  }

  if (!existsSync(cacheRoot)) {
    return {
      ok: true,
      cleaned: true,
      cacheRoot,
      removedEntries: 0,
      message: `cache clean: ${cacheRoot} absent (already empty)`,
    };
  }

  const names = readdirSync(cacheRoot).filter((n) => n !== "." && n !== "..");
  for (const name of names) {
    rmSync(join(cacheRoot, name), { recursive: true, force: true });
  }

  return {
    ok: true,
    cleaned: true,
    cacheRoot,
    removedEntries: names.length,
    message: `cache clean: removed ${names.length} entries from ${cacheRoot}`,
  };
}

export const cleanModulesCache = cacheClean;

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
