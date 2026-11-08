/**
 * Shared HTTP cache core: opt-in gate, keying, TTL, malformed fallback,
 * info/clean/prune.
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  BAPM_CACHE_DIR_ENV,
  BAPM_HTTP_CACHE_ENV,
  BAPM_HTTP_CACHE_TTL_ENV,
  BAPM_NO_CACHE_ENV,
  lookupSharedHttpCache,
  pruneSharedHttpCache,
  resolveSharedHttpCacheConfig,
  sharedHttpCacheClean,
  sharedHttpCacheInfo,
  sharedHttpCacheKey,
  storeSharedHttpCache,
} from "@b-apm/core";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("shared HTTP cache", () => {
  let root: string;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  function setup(): { cacheDir: string; httpDir: string } {
    root = mkdtempSync(join(tmpdir(), "bapm-shared-http-"));
    const cacheDir = join(root, "cache");
    return { cacheDir, httpDir: join(cacheDir, "http") };
  }

  function env(
    cacheDir?: string,
    extra: Record<string, string | undefined> = {},
  ): Record<string, string | undefined> {
    return {
      [BAPM_CACHE_DIR_ENV]: cacheDir,
      [BAPM_NO_CACHE_ENV]: undefined,
      [BAPM_HTTP_CACHE_ENV]: undefined,
      [BAPM_HTTP_CACHE_TTL_ENV]: undefined,
      ...extra,
    };
  }

  const request = {
    method: "GET",
    url: "https://registry.example/v1/packages/acme/demo/versions",
    headers: { accept: "application/json" },
  };

  function response(bodyText = '{"versions":[]}', status = 200) {
    return {
      status,
      headers: { "content-type": "application/json", "x-test": "yes" },
      body: new TextEncoder().encode(bodyText),
    };
  }

  function entryNames(httpDir: string): string[] {
    if (!existsSync(httpDir)) return [];
    return readdirSync(httpDir).filter((name) => !name.startsWith("."));
  }

  function age(path: string, days: number): void {
    const seconds = (Date.now() - days * DAY_MS) / 1000;
    utimesSync(path, seconds, seconds);
  }

  test("gate is off without BAPM_CACHE_DIR", () => {
    const config = resolveSharedHttpCacheConfig({ env: env() });
    expect(config.enabled).toBe(false);
    expect(config.reason).toBe("env-unset");
    expect(config.ttlSeconds).toBe(300);
  });

  test("BAPM_NO_CACHE and BAPM_HTTP_CACHE=0 both disable HTTP caching", () => {
    const noCache = resolveSharedHttpCacheConfig({
      env: env("/tmp/cache", { [BAPM_NO_CACHE_ENV]: "1" }),
    });
    expect(noCache.enabled).toBe(false);
    expect(noCache.reason).toBe("no-cache");
    expect(noCache.cacheDir).toBe("/tmp/cache");

    const httpOff = resolveSharedHttpCacheConfig({
      env: env("/tmp/cache", { [BAPM_HTTP_CACHE_ENV]: "0" }),
    });
    expect(httpOff.enabled).toBe(false);
    expect(httpOff.reason).toBe("http-cache-disabled");
    expect(httpOff.httpDir).toBe(join("/tmp/cache", "http"));
  });

  test("BAPM_HTTP_CACHE_TTL accepts nonnegative seconds and ignores invalid values", () => {
    expect(
      resolveSharedHttpCacheConfig({
        env: env("/tmp/cache", { [BAPM_HTTP_CACHE_TTL_ENV]: "15" }),
      }).ttlSeconds,
    ).toBe(15);
    expect(
      resolveSharedHttpCacheConfig({
        env: env("/tmp/cache", { [BAPM_HTTP_CACHE_TTL_ENV]: "nope" }),
      }).ttlSeconds,
    ).toBe(300);
  });

  test("cache key is stable across header order/case and differs by URL/header value", () => {
    const a = sharedHttpCacheKey(request.url, { Accept: "application/json", "x-b": "2" });
    const b = sharedHttpCacheKey(request.url, { "x-b": "2", accept: "application/json" });
    const c = sharedHttpCacheKey(request.url, { accept: "application/vnd.other" });
    const d = sharedHttpCacheKey(`${request.url}?page=2`, { accept: "application/json" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  test("store then lookup returns status/headers/body; layout is sha256(url+headers)", () => {
    const { cacheDir, httpDir } = setup();
    const stored = storeSharedHttpCache(request, response(), { env: env(cacheDir) });
    expect(stored.stored).toBe(true);
    expect(stored.path).toBe(join(httpDir, sharedHttpCacheKey(request.url, request.headers)));
    expect(entryNames(httpDir)).toHaveLength(1);

    const hit = lookupSharedHttpCache(request, { env: env(cacheDir) });
    expect(hit.hit).toBe(true);
    if (!hit.hit) throw new Error("expected cache hit");
    expect(hit.response.status).toBe(200);
    expect(hit.response.headers["x-test"]).toBe("yes");
    expect(new TextDecoder().decode(hit.response.body)).toBe('{"versions":[]}');
  });

  test("expired entries miss; ttl=0 never hits", () => {
    const { cacheDir, httpDir } = setup();
    storeSharedHttpCache(request, response(), { env: env(cacheDir) });
    const [name] = entryNames(httpDir);
    const path = join(httpDir, name!);
    const entry = JSON.parse(readFileSync(path, "utf8")) as { fetchedAt: number };
    entry.fetchedAt = Date.now() - 301_000;
    writeFileSync(path, JSON.stringify(entry), "utf8");

    expect(lookupSharedHttpCache(request, { env: env(cacheDir) })).toMatchObject({
      hit: false,
      reason: "expired",
    });
    expect(lookupSharedHttpCache(request, { env: env(cacheDir), ttlSeconds: 0 })).toMatchObject({
      hit: false,
      reason: "expired",
    });
  });

  test("Authorization/Cookie requests are never read or written", () => {
    const { cacheDir, httpDir } = setup();
    const sensitiveHeaders: Array<Record<string, string>> = [
      { authorization: "Bearer secret" },
      { Cookie: "session=abc" },
    ];
    for (const headers of sensitiveHeaders) {
      const authRequest = { ...request, headers };
      expect(storeSharedHttpCache(authRequest, response(), { env: env(cacheDir) }).stored).toBe(
        false,
      );
      expect(lookupSharedHttpCache(authRequest, { env: env(cacheDir) })).toMatchObject({
        hit: false,
        reason: "not-cacheable",
      });
    }
    expect(entryNames(httpDir)).toHaveLength(0);
  });

  test("non-GET and non-200 responses are never stored", () => {
    const { cacheDir, httpDir } = setup();
    expect(
      storeSharedHttpCache({ ...request, method: "POST" }, response(), {
        env: env(cacheDir),
      }).stored,
    ).toBe(false);
    expect(
      storeSharedHttpCache(request, response("not found", 404), {
        env: env(cacheDir),
      }).stored,
    ).toBe(false);
    expect(
      storeSharedHttpCache(request, response("boom", 500), {
        env: env(cacheDir),
      }).stored,
    ).toBe(false);
    expect(entryNames(httpDir)).toHaveLength(0);
  });

  test("malformed cache entries are a safe miss and can be repopulated", () => {
    const { cacheDir, httpDir } = setup();
    storeSharedHttpCache(request, response(), { env: env(cacheDir) });
    const [name] = entryNames(httpDir);
    const path = join(httpDir, name!);
    writeFileSync(path, "{not-json", "utf8");

    expect(lookupSharedHttpCache(request, { env: env(cacheDir) })).toMatchObject({
      hit: false,
      reason: "malformed",
    });
    expect(existsSync(path)).toBe(false);

    expect(storeSharedHttpCache(request, response(), { env: env(cacheDir) }).stored).toBe(true);
    expect(lookupSharedHttpCache(request, { env: env(cacheDir) }).hit).toBe(true);
  });

  test("no cache dir and bypass envs make store/lookup no-ops", () => {
    const { cacheDir, httpDir } = setup();
    expect(storeSharedHttpCache(request, response(), { env: env() }).stored).toBe(false);
    expect(lookupSharedHttpCache(request, { env: env() })).toMatchObject({
      hit: false,
      reason: "env-unset",
    });

    expect(
      storeSharedHttpCache(request, response(), {
        env: env(cacheDir, { [BAPM_NO_CACHE_ENV]: "1" }),
      }).stored,
    ).toBe(false);
    expect(
      storeSharedHttpCache(request, response(), {
        env: env(cacheDir, { [BAPM_HTTP_CACHE_ENV]: "0" }),
      }).stored,
    ).toBe(false);
    expect(entryNames(httpDir)).toHaveLength(0);
  });

  test("info reports HTTP entries/size alongside git without changing paths", () => {
    const { cacheDir, httpDir } = setup();
    mkdirSync(join(cacheDir, "git", "abc.git"), { recursive: true });
    writeFileSync(join(cacheDir, "git", "abc.git", "marker"), "mirror\n");
    storeSharedHttpCache(request, response(), { env: env(cacheDir) });

    const info = sharedHttpCacheInfo({ env: env(cacheDir) });
    expect(info.enabled).toBe(true);
    expect(info.httpDir).toBe(httpDir);
    expect(info.entries).toBe(1);
    expect(info.sizeBytes).toBeGreaterThan(0);
    expect(info.text).toMatch(/shared http cache/i);
    expect(info.text).toContain(httpDir);
    expect(info.text).toMatch(/ttl: 300s/);
  });

  test("clean is HTTP-only, requires yes, and never touches git mirrors", () => {
    const { cacheDir, httpDir } = setup();
    mkdirSync(join(cacheDir, "git", "abc.git"), { recursive: true });
    writeFileSync(join(cacheDir, "git", "abc.git", "marker"), "mirror\n");
    storeSharedHttpCache(request, response(), { env: env(cacheDir) });

    const dry = sharedHttpCacheClean({ env: env(cacheDir), dryRun: true });
    expect(dry.ok).toBe(true);
    expect(dry.removedEntries).toBe(1);
    expect(entryNames(httpDir)).toHaveLength(1);

    const refused = sharedHttpCacheClean({ env: env(cacheDir) });
    expect(refused.ok).toBe(false);
    expect(refused.refused).toBe(true);
    expect(entryNames(httpDir)).toHaveLength(1);

    const cleaned = sharedHttpCacheClean({ env: env(cacheDir), yes: true });
    expect(cleaned.ok).toBe(true);
    expect(cleaned.cleaned).toBe(true);
    expect(entryNames(httpDir)).toHaveLength(0);
    expect(existsSync(join(cacheDir, "git", "abc.git", "marker"))).toBe(true);
  });

  test("prune removes old HTTP entries only, honors --days, and skips symlinks", () => {
    const { cacheDir, httpDir } = setup();
    mkdirSync(httpDir, { recursive: true });
    mkdirSync(join(cacheDir, "git", "abc.git"), { recursive: true });
    const old = join(httpDir, "old-entry");
    const recent = join(httpDir, "recent-entry");
    const link = join(httpDir, "linked-entry");
    writeFileSync(old, "old");
    writeFileSync(recent, "recent");
    symlinkSync(old, link);
    age(old, 40);
    age(link, 40);

    const result = pruneSharedHttpCache({ env: env(cacheDir) });
    expect(result.ok).toBe(true);
    expect(result.pruned).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.candidates).toEqual(["old-entry"]);
    expect(result.root).toBe(httpDir);
    expect(existsSync(old)).toBe(false);
    expect(existsSync(recent)).toBe(true);
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(existsSync(join(cacheDir, "git", "abc.git"))).toBe(true);

    const zeroDays = pruneSharedHttpCache({ env: env(cacheDir), days: 0, dryRun: true });
    expect(zeroDays.ok).toBe(true);
    // Symlinks are never candidates (and are never followed).
    expect(zeroDays.candidates).toEqual(["recent-entry"]);
  });

  test("invalid prune days is refused before mutation", () => {
    const { cacheDir, httpDir } = setup();
    mkdirSync(httpDir, { recursive: true });
    const entry = join(httpDir, "entry");
    writeFileSync(entry, "x");

    const result = pruneSharedHttpCache({ env: env(cacheDir), days: -1 });
    expect(result.ok).toBe(false);
    expect(result.refused).toBe(true);
    expect(result.pruned).toBe(0);
    expect(existsSync(entry)).toBe(true);
  });

  test("prune without BAPM_CACHE_DIR is an informational no-op", () => {
    const result = pruneSharedHttpCache({ env: env() });
    expect(result.ok).toBe(true);
    expect(result.pruned).toBe(0);
    expect(result.root).toBeUndefined();
    expect(result.message).toMatch(/shared cache not configured/i);
  });
});
