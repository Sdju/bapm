/**
 * sc-003 — Cross-class HTTP 3xx drops origin Authorization before follow.
 * Production Registry transport must not silently forward Bearer across classes.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { getCreateFetchTransport, getFetchWithRedirectAuthDrop } from "./helpers.ts";

const ORIGIN_SECRET = "Bearer origin-class-SECRET-sc-host-class-REDIRECT";
const ORIGIN_URL = "https://pkgs.example.com/v1/packages/contoso/demo/versions/1.0.0";
const DEST_URL = "https://cdn.evil.net/artifacts/demo.zip";

type Hop = { url: string; authorization: string | null };

describe("sc-host-class redirect Auth drop (sc-003)", () => {
  let restoreFetch: (() => void) | undefined;

  afterEach(() => {
    restoreFetch?.();
    restoreFetch = undefined;
  });

  function installFetchRecorder(handler: (hop: Hop, count: number) => Response): Hop[] {
    const hops: Hop[] = [];
    const original = globalThis.fetch;
    let count = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      const hop: Hop = { url, authorization: headers.get("authorization") };
      hops.push(hop);
      count += 1;
      return handler(hop, count);
    }) as typeof fetch;
    restoreFetch = () => {
      globalThis.fetch = original;
    };
    return hops;
  }

  test("fetchWithRedirectAuthDrop strips Authorization on cross-class 302", async () => {
    const hops = installFetchRecorder((hop, count) => {
      if (count === 1) {
        expect(hop.url).toMatch(/pkgs\.example\.com/);
        return new Response(null, {
          status: 302,
          headers: { Location: DEST_URL },
        });
      }
      return new Response("ok-body", { status: 200 });
    });

    const fetchSafe = getFetchWithRedirectAuthDrop();
    const res = await fetchSafe(ORIGIN_URL, {
      method: "GET",
      headers: { Authorization: ORIGIN_SECRET },
      redirect: "manual",
    });

    expect(res.status).toBe(200);
    expect(hops.length).toBeGreaterThanOrEqual(2);
    const follow = hops.find((h) => /cdn\.evil\.net/i.test(h.url));
    expect(follow, `expected follow hop to ${DEST_URL}; hops=${JSON.stringify(hops)}`).toBeTruthy();
    expect(
      follow!.authorization,
      "origin Authorization must not ride cross-class redirect",
    ).toBeNull();
  });

  test("same-class redirect may retain destination-appropriate Authorization", async () => {
    const sameClassDest = "https://api.pkgs.example.com/v1/mirror/demo.zip";
    const hops = installFetchRecorder((hop, count) => {
      if (count === 1) {
        return new Response(null, {
          status: 302,
          headers: { Location: sameClassDest },
        });
      }
      return new Response("same-class-ok", { status: 200 });
    });

    const fetchSafe = getFetchWithRedirectAuthDrop();
    await fetchSafe(ORIGIN_URL, {
      method: "GET",
      headers: { Authorization: ORIGIN_SECRET },
    });

    expect(hops.length).toBeGreaterThanOrEqual(2);
    const follow = hops.find((h) => /api\.pkgs\.example\.com/i.test(h.url));
    expect(follow).toBeTruthy();
    // Same PSL class: MAY keep Auth (APM allows). Assert follow happened.
    expect(follow!.url).toMatch(/api\.pkgs\.example\.com/);
  });

  test("production createFetchTransport is redirect-safe for Authed cross-class 3xx", async () => {
    const hops = installFetchRecorder((hop, count) => {
      if (count === 1) {
        return new Response(null, {
          status: 302,
          headers: { Location: DEST_URL },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const create = getCreateFetchTransport();
    const transport = create();
    await transport.fetch({
      method: "GET",
      url: ORIGIN_URL,
      headers: { Authorization: ORIGIN_SECRET },
    });

    expect(
      hops.length,
      `Authed transport must follow cross-class redirect safely; hops=${JSON.stringify(hops)}`,
    ).toBeGreaterThanOrEqual(2);
    const follow = hops.find((h) => /cdn\.evil\.net/i.test(h.url));
    expect(follow, "expected redirected request to destination host").toBeTruthy();
    expect(
      follow!.authorization,
      "Registry transport must drop origin Bearer on cross-class redirect",
    ).toBeNull();
  });
});
