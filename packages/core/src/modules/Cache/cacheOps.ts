import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { APM_MODULES_DIR } from "@/modules/Resolver";
import type {
  CacheCleanOptions,
  CacheCleanResult,
  CacheInfoOptions,
  CacheInfoResult,
} from "./types.ts";

/**
 * Report modules-cache root + size/entry stats (project `apm_modules`).
 * Does not introduce a shared APM git/http cache (rs-016 identity preserved).
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
  const text = empty
    ? `cache root: ${cacheRoot}\nentries: 0\nsize: 0 bytes\nstatus: empty`
    : `cache root: ${cacheRoot}\nentries: ${entries}\nsize: ${sizeBytes} bytes\nfiles/dirs under apm_modules`;

  return {
    cacheRoot,
    exists,
    entries,
    sizeBytes,
    empty,
    text,
  };
}

export const getCacheInfo = cacheInfo;
export const modulesCacheInfo = cacheInfo;

/**
 * Remove modules-cache content. Without `yes`/`-y`, refuses (non-silent).
 */
export function cacheClean(options: CacheCleanOptions = {}): CacheCleanResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  const cacheRoot = resolve(options.cacheRoot ?? join(cwd, APM_MODULES_DIR));
  const yes = options.yes === true || options.y === true;
  const requireYes = options.requireYes !== false;

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
