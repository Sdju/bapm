/**
 * P2 shared HTTP cache integration through createFetchTransport.
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  BAPM_CACHE_DIR_ENV,
  BAPM_HTTP_CACHE_ENV,
  BAPM_HTTP_CACHE_TTL_ENV,
  BAPM_NO_CACHE_ENV,
  createFetchTransport,
  sharedHttpCacheKey,
} from "@b-apm/core";

const URL = "https://registry.example/v1/packages/acme/demo/versions";

describe("createFetchTransport shared HTTP cache", () => {
  let root: string;
  let previousFetch: typeof fetch | undefined;

  afterEach(() => {
    if (previousFetch) globalThis.fetch = previousFetch;
    previousFetch = undefined;
    if (root) rmSync(root, { recursive: true, force: true });
  });

  function setup(): { cacheDir: string; httpDir: string; env: Record<string, string | undefined> } {
    root = mkdtempSync(join(tmpdir(), "bapm-http-transport-"));
    const cacheDir = join(root, "cache");
    return {
      cacheDir,
      httpDir: join(cacheDir, "http"),
      env: {
        [BAPM_CACHE_DIR_ENV]: cacheDir,
        [BAPM_NO_CACHE_ENV]: undefined,
        [BAPM_HTTP_CACHE_ENV]: undefined,
        [BAPM_HTTP_CACHE_TTL_ENV]: undefined,
      },
    };
  }

  function names(httpDir: string): string[] {
    if (!existsSync(httpDir)) return [];
    return readdirSync(httpDir).filter((name) => !name.startsWith("."));
  }

  function installFetch(
    handler: (
      url: string,
      init: RequestInit | undefined,
      call: number,
    ) => Response | Promise<Response>,
  ): { calls: () => number } {
    previousFetch = globalThis.fetch;
    let count = 0;
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      count += 1;
      const url =
        typeof input === "string"
          ? input
          : "url" in input && typeof input.url === "string"
            ? input.url
            : "href" in input && typeof input.href === "string"
              ? input.href
              : "";
      return handler(url, init, count);
    }) as typeof fetch;
    return { calls: () => count };
  }

  function okJson(call: number): Response {
    return new Response(
      JSON.stringify({ versions: [{ version: `1.0.${call}`, digest: "sha256:x" }] }),
      {
        status: 200,
        headers: { "content-type": "application/json", "x-fetch": String(call) },
      },
    );
  }

  test("first GET populates the cache and the second GET makes no network call", async () => {
    const { httpDir, env } = setup();
    const fetchState = installFetch((_url, _init, call) => okJson(call));
    const transport = createFetchTransport({ env });

    const first = await transport.fetch({ method: "GET", url: URL });
    expect(first.status).toBe(200);
    expect(JSON.parse(new TextDecoder().decode(first.body)).versions[0].version).toBe("1.0.1");
    expect(names(httpDir)).toEqual([sharedHttpCacheKey(URL)]);

    const second = await transport.fetch({ method: "GET", url: URL });
    expect(fetchState.calls()).toBe(1);
    expect(second.headers["x-fetch"]).toBe("1");
    expect(JSON.parse(new TextDecoder().decode(second.body)).versions[0].version).toBe("1.0.1");
  });

  test("TTL expiry refetches (BAPM_HTTP_CACHE_TTL=0)", async () => {
    const { env } = setup();
    const fetchState = installFetch((_url, _init, call) => okJson(call));
    const transport = createFetchTransport({
      env: { ...env, [BAPM_HTTP_CACHE_TTL_ENV]: "0" },
    });

    await transport.fetch({ method: "GET", url: URL });
    await transport.fetch({ method: "GET", url: URL });
    expect(fetchState.calls()).toBe(2);
  });

  test("Authorization and Cookie requests bypass cache", async () => {
    const { httpDir, env } = setup();
    const fetchState = installFetch((_url, _init, call) => okJson(call));
    const transport = createFetchTransport({ env });

    await transport.fetch({
      method: "GET",
      url: URL,
      headers: { authorization: "Bearer secret" },
    });
    await transport.fetch({
      method: "GET",
      url: URL,
      headers: { Cookie: "session=abc" },
    });
    expect(fetchState.calls()).toBe(2);
    expect(names(httpDir)).toHaveLength(0);
  });

  test("POST/PUT/PATCH/DELETE are never cached", async () => {
    const { httpDir, env } = setup();
    const fetchState = installFetch((_url, _init, call) => okJson(call));
    const transport = createFetchTransport({ env });

    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      await transport.fetch({ method, url: URL, body: new Uint8Array([1, 2, 3]) });
      await transport.fetch({ method, url: URL, body: new Uint8Array([1, 2, 3]) });
    }
    expect(fetchState.calls()).toBe(8);
    expect(names(httpDir)).toHaveLength(0);
  });

  test("4xx and 5xx responses are never cached", async () => {
    const { httpDir, env } = setup();
    let status = 404;
    const fetchState = installFetch(
      () => new Response("nope", { status, headers: { "x-status": String(status) } }),
    );
    const transport = createFetchTransport({ env });

    await transport.fetch({ method: "GET", url: URL });
    await transport.fetch({ method: "GET", url: URL });
    expect(fetchState.calls()).toBe(2);
    expect(names(httpDir)).toHaveLength(0);

    status = 500;
    await transport.fetch({ method: "GET", url: URL });
    await transport.fetch({ method: "GET", url: URL });
    expect(fetchState.calls()).toBe(4);
    expect(names(httpDir)).toHaveLength(0);
  });

  test("malformed cache entry falls back to network and is repaired", async () => {
    const { httpDir, env } = setup();
    const fetchState = installFetch((_url, _init, call) => okJson(call));
    const transport = createFetchTransport({ env });

    await transport.fetch({ method: "GET", url: URL });
    const [name] = names(httpDir);
    const path = join(httpDir, name!);
    writeFileSync(path, "{broken", "utf8");

    const repaired = await transport.fetch({ method: "GET", url: URL });
    expect(fetchState.calls()).toBe(2);
    expect(repaired.headers["x-fetch"]).toBe("2");
    expect(() => JSON.parse(readFileSync(path, "utf8"))).not.toThrow();
  });

  test("no cache dir and bypass envs never populate cache", async () => {
    const { cacheDir, httpDir } = setup();
    const fetchState = installFetch((_url, _init, call) => okJson(call));

    const noDir = createFetchTransport({
      env: { [BAPM_CACHE_DIR_ENV]: undefined, [BAPM_NO_CACHE_ENV]: undefined },
    });
    await noDir.fetch({ method: "GET", url: URL });
    await noDir.fetch({ method: "GET", url: URL });
    expect(fetchState.calls()).toBe(2);

    const noCache = createFetchTransport({
      env: {
        [BAPM_CACHE_DIR_ENV]: cacheDir,
        [BAPM_NO_CACHE_ENV]: "1",
      },
    });
    await noCache.fetch({ method: "GET", url: URL });
    await noCache.fetch({ method: "GET", url: URL });
    expect(fetchState.calls()).toBe(4);

    const httpOff = createFetchTransport({
      env: {
        [BAPM_CACHE_DIR_ENV]: cacheDir,
        [BAPM_HTTP_CACHE_ENV]: "0",
      },
    });
    await httpOff.fetch({ method: "GET", url: URL });
    await httpOff.fetch({ method: "GET", url: URL });
    expect(fetchState.calls()).toBe(6);
    expect(names(httpDir)).toHaveLength(0);
  });

  test("manual redirect keeps redirect-safety and caches the final 200 by original URL", async () => {
    const { httpDir, env } = setup();
    const finalUrl = "https://registry.example/final";
    const fetchState = installFetch((url, _init, call) => {
      if (url === URL) {
        return new Response(null, { status: 302, headers: { location: finalUrl } });
      }
      return okJson(call);
    });
    const transport = createFetchTransport({ env });

    const first = await transport.fetch({ method: "GET", url: URL });
    expect(first.status).toBe(200);
    expect(fetchState.calls()).toBe(2);
    expect(names(httpDir)).toEqual([sharedHttpCacheKey(URL)]);

    const second = await transport.fetch({ method: "GET", url: URL });
    expect(second.status).toBe(200);
    expect(fetchState.calls()).toBe(2);
  });
});
