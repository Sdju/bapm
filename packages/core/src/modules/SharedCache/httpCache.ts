import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type {
  SharedHttpCacheCleanOptions,
  SharedHttpCacheCleanResult,
  SharedHttpCacheConfig,
  SharedHttpCacheInfoOptions,
  SharedHttpCacheInfoResult,
  SharedHttpCacheLookupResult,
  SharedHttpCacheOverride,
  SharedHttpCachePruneCandidate,
  SharedHttpCachePruneFailure,
  SharedHttpCachePruneOptions,
  SharedHttpCachePruneResult,
  SharedHttpCacheRequest,
  SharedHttpCacheResponse,
  SharedHttpCacheStoreResult,
} from "./types.ts";

export const BAPM_HTTP_CACHE_ENV = "BAPM_HTTP_CACHE";
export const BAPM_HTTP_CACHE_TTL_ENV = "BAPM_HTTP_CACHE_TTL";
export const SHARED_HTTP_CACHE_SUBDIR = "http";
export const DEFAULT_SHARED_HTTP_TTL_SECONDS = 300;
export const DEFAULT_SHARED_HTTP_PRUNE_DAYS = 30;

const BAPM_CACHE_DIR_ENV = "BAPM_CACHE_DIR";
const BAPM_NO_CACHE_ENV = "BAPM_NO_CACHE";
const DAY_MS = 24 * 60 * 60 * 1000;
const ENTRY_VERSION = 1;

type StoredHttpEntry = {
  version: number;
  url: string;
  method: "GET";
  status: 200;
  headers: Record<string, string>;
  /** Base64-encoded response body. */
  bodyBase64: string;
  /** Epoch milliseconds. */
  fetchedAt: number;
};

/**
 * Resolve the opt-in shared HTTP cache gate. Enabled only when
 * `BAPM_CACHE_DIR` is set, `BAPM_NO_CACHE` is off, and `BAPM_HTTP_CACHE`
 * is not `0`/`false`/`off`.
 */
export function resolveSharedHttpCacheConfig(
  options: SharedHttpCacheOverride = {},
): SharedHttpCacheConfig {
  const env = options.env ?? process.env;
  const rawDir = (options.cacheDir ?? env[BAPM_CACHE_DIR_ENV])?.trim();
  const noCache = options.noCache ?? envFlag(env[BAPM_NO_CACHE_ENV]);
  const httpCacheDisabled =
    options.httpCache === undefined
      ? isDisabledFlag(env[BAPM_HTTP_CACHE_ENV])
      : options.httpCache === false;
  const ttlSeconds = normalizeTtlSeconds(options.ttlSeconds ?? env[BAPM_HTTP_CACHE_TTL_ENV]);
  const cacheDir = rawDir ? resolve(rawDir) : undefined;
  const httpDir = cacheDir ? join(cacheDir, SHARED_HTTP_CACHE_SUBDIR) : undefined;

  if (!cacheDir) {
    return {
      enabled: false,
      ttlSeconds,
      disabledByNoCache: noCache,
      disabledByHttpCache: httpCacheDisabled,
      reason: "env-unset",
    };
  }

  if (noCache) {
    return {
      enabled: false,
      cacheDir,
      httpDir,
      ttlSeconds,
      disabledByNoCache: true,
      disabledByHttpCache: httpCacheDisabled,
      reason: "no-cache",
    };
  }

  if (httpCacheDisabled) {
    return {
      enabled: false,
      cacheDir,
      httpDir,
      ttlSeconds,
      disabledByNoCache: false,
      disabledByHttpCache: true,
      reason: "http-cache-disabled",
    };
  }

  return {
    enabled: true,
    cacheDir,
    httpDir,
    ttlSeconds,
    disabledByNoCache: false,
    disabledByHttpCache: false,
    reason: "enabled",
  };
}

/**
 * Cache key: `sha256(url + canonical headers)`. Header names are lowercased
 * and sorted; values are preserved. Only used for GET requests without
 * credential/cookie headers.
 */
export function sharedHttpCacheKey(url: string, headers?: Record<string, string>): string {
  const pairs = Object.entries(headers ?? {}).map(
    ([name, value]) => [name.toLowerCase(), String(value)] as const,
  );
  pairs.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
  return createHash("sha256")
    .update(JSON.stringify([url, pairs]))
    .digest("hex");
}

/** True when the request is a GET without Authorization/Cookie-style headers. */
export function isSharedHttpCacheableRequest(request: SharedHttpCacheRequest): boolean {
  return cacheableRequestReason(request) === undefined;
}

/**
 * Read a fresh entry. Never throws: malformed/unreadable entries are a miss so
 * the caller falls back to the network.
 */
export function lookupSharedHttpCache(
  request: SharedHttpCacheRequest,
  options: SharedHttpCacheOverride = {},
): SharedHttpCacheLookupResult {
  const config = resolveSharedHttpCacheConfig(options);
  if (!config.enabled || !config.httpDir) {
    return { hit: false, reason: config.reason };
  }
  if (cacheableRequestReason(request) !== undefined) {
    return { hit: false, reason: "not-cacheable" };
  }

  const path = join(config.httpDir, sharedHttpCacheKey(request.url, request.headers));
  if (!existsSync(path)) return { hit: false, reason: "miss", path };

  let entry: StoredHttpEntry;
  try {
    entry = parseStoredEntry(readFileSync(path, "utf8"), request);
  } catch {
    removeBestEffort(path);
    return { hit: false, reason: "malformed", path };
  }

  const ageMs = Math.max(0, Date.now() - entry.fetchedAt);
  if (config.ttlSeconds <= 0 || ageMs > config.ttlSeconds * 1000) {
    return { hit: false, reason: "expired", path };
  }

  return {
    hit: true,
    path,
    ageMs,
    response: {
      status: entry.status,
      headers: { ...entry.headers },
      body: new Uint8Array(Buffer.from(entry.bodyBase64, "base64")),
    },
  };
}

/**
 * Store a successful GET 200 response. Never throws: cache failures degrade to
 * a normal network response for the caller.
 */
export function storeSharedHttpCache(
  request: SharedHttpCacheRequest,
  response: SharedHttpCacheResponse,
  options: SharedHttpCacheOverride = {},
): SharedHttpCacheStoreResult {
  const config = resolveSharedHttpCacheConfig(options);
  if (!config.enabled || !config.httpDir) {
    return { stored: false, reason: config.reason };
  }
  if (cacheableRequestReason(request) !== undefined) {
    return { stored: false, reason: "not-cacheable" };
  }
  if (response.status !== 200) {
    return { stored: false, reason: "not-200" };
  }

  const path = join(config.httpDir, sharedHttpCacheKey(request.url, request.headers));
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    mkdirSync(config.httpDir, { recursive: true });
    const entry: StoredHttpEntry = {
      version: ENTRY_VERSION,
      url: request.url,
      method: "GET",
      status: 200,
      headers: normalizeResponseHeaders(response.headers),
      bodyBase64: Buffer.from(response.body).toString("base64"),
      fetchedAt: Date.now(),
    };
    writeFileSync(temp, `${JSON.stringify(entry)}\n`, "utf8");
    renameSync(temp, path);
    return { stored: true, path };
  } catch (error) {
    removeBestEffort(temp);
    return {
      stored: false,
      reason: "write-error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Shared HTTP-cache root/path + size stats. Safe to call when disabled. */
export function sharedHttpCacheInfo(
  options: SharedHttpCacheInfoOptions = {},
): SharedHttpCacheInfoResult {
  const config = resolveSharedHttpCacheConfig(options);
  const httpDir = config.httpDir;
  const exists = Boolean(httpDir && existsSync(httpDir) && statSync(httpDir).isDirectory());

  let entries = 0;
  let sizeBytes = 0;
  const entryPaths: string[] = [];
  if (httpDir && exists) {
    for (const name of readdirSync(httpDir)) {
      if (name === "." || name === "..") continue;
      const path = join(httpDir, name);
      try {
        lstatSync(path);
      } catch {
        continue;
      }
      entries += 1;
      sizeBytes += dirSize(path);
      entryPaths.push(path);
    }
  }

  const empty = entries === 0;
  const lines: string[] = [];
  if (config.reason === "env-unset") {
    lines.push(
      "shared http cache: disabled (set BAPM_CACHE_DIR to enable; BAPM_HTTP_CACHE=0 disables HTTP caching)",
    );
  } else if (config.reason === "no-cache") {
    lines.push("shared http cache: disabled by BAPM_NO_CACHE");
    if (httpDir) lines.push(`cache root: ${httpDir}`);
  } else if (config.reason === "http-cache-disabled") {
    lines.push("shared http cache: disabled by BAPM_HTTP_CACHE=0");
    if (httpDir) lines.push(`cache root: ${httpDir}`);
  } else if (!exists) {
    lines.push(`shared http cache: ${httpDir} (absent/empty)`);
    lines.push("entries: 0");
    lines.push("size: 0 bytes");
    lines.push(`ttl: ${config.ttlSeconds}s`);
  } else if (empty) {
    lines.push(`shared http cache: ${httpDir}`);
    lines.push("entries: 0");
    lines.push("size: 0 bytes");
    lines.push(`ttl: ${config.ttlSeconds}s`);
    lines.push("status: empty");
  } else {
    lines.push(`shared http cache: ${httpDir}`);
    lines.push(`entries: ${entries}`);
    lines.push(`size: ${sizeBytes} bytes`);
    lines.push(`ttl: ${config.ttlSeconds}s`);
    lines.push("GET 200 responses keyed by sha256(url + request headers)");
  }

  return {
    enabled: config.enabled,
    cacheDir: config.cacheDir,
    httpDir,
    reason: config.reason,
    ttlSeconds: config.ttlSeconds,
    disabledByNoCache: config.disabledByNoCache,
    disabledByHttpCache: config.disabledByHttpCache,
    exists,
    entries,
    sizeBytes,
    empty,
    entryPaths,
    text: lines.join("\n"),
  };
}

/**
 * Remove shared HTTP cache entries only. Git mirrors and project `apm_modules`
 * are never touched by this operation.
 */
export function sharedHttpCacheClean(
  options: SharedHttpCacheCleanOptions = {},
): SharedHttpCacheCleanResult {
  const config = resolveSharedHttpCacheConfig(options);
  const httpDir = config.httpDir;
  if (!httpDir) {
    return {
      ok: true,
      cleaned: false,
      enabled: false,
      removedEntries: 0,
      message: "shared http cache: disabled (BAPM_CACHE_DIR unset); nothing to clean",
    };
  }

  const dryRun = options.dryRun === true;
  const yes = options.yes === true || options.y === true;
  const requireYes = options.requireYes !== false;
  const names = existsSync(httpDir)
    ? readdirSync(httpDir).filter((name) => name !== "." && name !== "..")
    : [];

  if (dryRun) {
    return {
      ok: true,
      cleaned: false,
      enabled: config.enabled,
      cacheDir: config.cacheDir,
      httpDir,
      removedEntries: names.length,
      message:
        names.length === 0
          ? `shared http cache clean dry-run: ${httpDir} empty (would remove 0); git mirrors/apm_modules untouched`
          : `shared http cache clean dry-run: would remove ${names.length} entries from ${httpDir}; ` +
            "git mirrors/apm_modules untouched",
    };
  }

  if (!yes && requireYes) {
    return {
      ok: false,
      cleaned: false,
      enabled: config.enabled,
      cacheDir: config.cacheDir,
      httpDir,
      removedEntries: 0,
      refused: true,
      message:
        `shared http cache clean refused: require -y / --yes to delete entries at ${httpDir}; ` +
        "git mirrors and apm_modules are never removed by this command",
    };
  }

  for (const name of names) {
    rmSync(join(httpDir, name), { recursive: true, force: true });
  }

  return {
    ok: true,
    cleaned: true,
    enabled: config.enabled,
    cacheDir: config.cacheDir,
    httpDir,
    removedEntries: names.length,
    message:
      `shared http cache clean: removed ${names.length} entries from ${httpDir}; ` +
      "git mirrors/apm_modules untouched",
  };
}

/**
 * Remove shared HTTP cache entries whose last modification/access time is older
 * than `days` (default 30). Symlinks are skipped and never followed; deletion is
 * per entry so one failure does not stop the sweep.
 */
export function pruneSharedHttpCache(
  options: SharedHttpCachePruneOptions = {},
): SharedHttpCachePruneResult {
  const config = resolveSharedHttpCacheConfig(options);
  const days = options.days ?? DEFAULT_SHARED_HTTP_PRUNE_DAYS;
  const dryRun = options.dryRun === true;
  const yes = options.yes === true || options.y === true;
  const requireYes = options.requireYes === true;
  const base = {
    enabled: config.enabled,
    reason: config.reason,
    cacheDir: config.cacheDir,
    httpDir: config.httpDir,
    root: config.httpDir,
    days,
    dryRun,
    candidates: [] as string[],
    candidateDetails: [] as SharedHttpCachePruneCandidate[],
    pruned: 0,
    failed: 0,
    failures: [] as SharedHttpCachePruneFailure[],
  };

  if (!Number.isInteger(days) || days < 0) {
    return {
      ...base,
      ok: false,
      refused: true,
      message:
        `shared http cache prune refused: --days must be a nonnegative integer ` +
        `(got ${String(options.days)}); nothing was deleted`,
    };
  }

  if (!config.httpDir) {
    return {
      ...base,
      ok: true,
      message:
        "shared cache not configured: set BAPM_CACHE_DIR to enable the shared http cache; " +
        "project apm_modules is handled by bapm prune",
    };
  }

  const root = config.httpDir;
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    return {
      ...base,
      ok: true,
      message:
        `shared http cache prune: ${root} absent/empty; nothing to prune ` +
        "(git mirrors/apm_modules untouched)",
    };
  }

  const now = Date.now();
  const cutoff = now - days * DAY_MS;
  const details: SharedHttpCachePruneCandidate[] = [];
  for (const name of readdirSync(root)) {
    if (name === "." || name === "..") continue;
    const path = join(root, name);
    let st: ReturnType<typeof lstatSync>;
    try {
      st = lstatSync(path);
    } catch {
      continue;
    }
    // Never follow a symlink; entry names are files written by the transport.
    if (st.isSymbolicLink()) continue;
    const lastUsedMs = Math.max(st.mtimeMs, st.atimeMs);
    if (days !== 0 && lastUsedMs >= cutoff) continue;
    details.push({
      name,
      path,
      ageDays: Math.max(0, Math.floor((now - lastUsedMs) / DAY_MS)),
      lastUsedMs,
    });
  }
  details.sort((a, b) => a.name.localeCompare(b.name));

  const candidates = details.map((entry) => entry.name);
  const withCandidates = { ...base, candidates, candidateDetails: details };

  if (details.length === 0) {
    return {
      ...withCandidates,
      ok: true,
      message:
        `shared http cache prune: no entries older than ${days} day(s) in ${root} ` +
        "(git mirrors/apm_modules untouched)",
    };
  }

  if (dryRun) {
    return {
      ...withCandidates,
      ok: true,
      message:
        `shared http cache prune dry-run: would prune ${details.length} entry(ies) ` +
        `older than ${days} day(s) from ${root} (${candidates.join(", ")}); ` +
        "git mirrors/apm_modules untouched",
    };
  }

  if (!yes && requireYes) {
    return {
      ...withCandidates,
      ok: false,
      refused: true,
      message:
        `shared http cache prune refused: require -y / --yes to delete entries at ${root}; ` +
        "git mirrors and apm_modules are never removed by this command",
    };
  }

  let pruned = 0;
  const failures: SharedHttpCachePruneFailure[] = [];
  for (const entry of details) {
    try {
      const st = lstatSync(entry.path);
      if (st.isSymbolicLink()) continue;
      if (!isDescendantPath(root, entry.path)) continue;
      rmSync(entry.path, { recursive: true, force: true });
      pruned += 1;
    } catch (error) {
      failures.push({
        name: entry.name,
        path: entry.path,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const failedNames = failures.map((failure) => failure.name);
  const summary =
    failures.length === 0
      ? `shared http cache prune: pruned ${pruned} of ${details.length} entry(ies) ` +
        `older than ${days} day(s) from ${root}; git mirrors/apm_modules untouched`
      : `shared http cache prune: pruned ${pruned} of ${details.length} entry(ies), ` +
        `${failures.length} failed older than ${days} day(s) in ${root} ` +
        `(failed: ${failedNames.join(", ")}); git mirrors/apm_modules untouched`;

  return {
    ...withCandidates,
    ok: failures.length === 0,
    pruned,
    failed: failures.length,
    failures,
    message: summary,
  };
}

function cacheableRequestReason(request: SharedHttpCacheRequest): string | undefined {
  if (request.method.trim().toUpperCase() !== "GET") return "method";
  for (const name of Object.keys(request.headers ?? {})) {
    if (isSensitiveHeader(name)) return "sensitive-header";
  }
  return undefined;
}

function isSensitiveHeader(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return (
    lower === "authorization" ||
    lower === "cookie" ||
    lower === "proxy-authorization" ||
    lower === "private-token"
  );
}

function parseStoredEntry(raw: string, request: SharedHttpCacheRequest): StoredHttpEntry {
  const parsed = JSON.parse(raw) as unknown;
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("cache entry is not an object");
  }
  const entry = parsed as Partial<StoredHttpEntry>;
  if (entry.version !== ENTRY_VERSION) throw new Error("unsupported cache entry version");
  if (entry.url !== request.url) throw new Error("cache entry URL mismatch");
  if (entry.method !== "GET") throw new Error("cache entry method mismatch");
  if (entry.status !== 200) throw new Error("cache entry status mismatch");
  if (typeof entry.fetchedAt !== "number" || !Number.isFinite(entry.fetchedAt)) {
    throw new Error("cache entry timestamp is invalid");
  }
  if (typeof entry.bodyBase64 !== "string") throw new Error("cache entry body is invalid");
  // Reject non-canonical/garbage base64 instead of silently returning bytes
  // that differ from the stored response.
  if (Buffer.from(entry.bodyBase64, "base64").toString("base64") !== entry.bodyBase64) {
    throw new Error("cache entry body is not valid base64");
  }
  const headers = entry.headers;
  if (headers === null || typeof headers !== "object" || Array.isArray(headers)) {
    throw new Error("cache entry headers are invalid");
  }
  const normalized: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (typeof value !== "string") throw new Error("cache entry header value is invalid");
    normalized[name.toLowerCase()] = value;
  }
  return {
    version: ENTRY_VERSION,
    url: request.url,
    method: "GET",
    status: 200,
    headers: normalized,
    bodyBase64: entry.bodyBase64,
    fetchedAt: entry.fetchedAt,
  };
}

function normalizeResponseHeaders(headers: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    normalized[name.toLowerCase()] = String(value);
  }
  return normalized;
}

function normalizeTtlSeconds(value: number | string | undefined): number {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 ? value : DEFAULT_SHARED_HTTP_TTL_SECONDS;
  }
  if (typeof value !== "string") return DEFAULT_SHARED_HTTP_TTL_SECONDS;
  const trimmed = value.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return DEFAULT_SHARED_HTTP_TTL_SECONDS;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : DEFAULT_SHARED_HTTP_TTL_SECONDS;
}

function isDescendantPath(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target));
  return Boolean(rel) && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
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

function isDisabledFlag(value: string | undefined): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^(?:0|false|no|off)$/i.test(trimmed);
}

function removeBestEffort(path: string): void {
  try {
    rmSync(path, { force: true });
  } catch {
    // A stale/corrupt entry is harmless; prune can remove it later.
  }
}
