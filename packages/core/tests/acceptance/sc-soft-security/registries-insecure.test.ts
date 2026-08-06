/**
 * sc-006 / G7–G8 — registries.*.insecure + parse-time http gate (RED until apply).
 */
import { describe, expect, test } from "vite-plus/test";
import { expectThrowsMatching, getParseManifest } from "./helpers.ts";

describe("sc-soft-security registries insecure + http gate", () => {
  test("https registry still accepted", () => {
    const doc = getParseManifest()({
      name: "demo",
      version: "1.0.0",
      registries: {
        contoso: { url: "https://registry.contoso.example.com/apm" },
      },
    });
    const registries = doc.registries as Record<string, unknown>;
    expect(registries.contoso).toMatchObject({
      url: "https://registry.contoso.example.com/apm",
    });
  });

  test("insecure: true allows remote http registry (G7)", () => {
    const doc = getParseManifest()({
      name: "demo",
      version: "1.0.0",
      registries: {
        contoso: {
          url: "http://example.com/apm",
          insecure: true,
        },
      },
    });
    const registries = doc.registries as Record<string, { insecure?: boolean; url: string }>;
    expect(registries.contoso.url).toBe("http://example.com/apm");
    expect(registries.contoso.insecure).toBe(true);
  });

  test("remote http without insecure rejected and names registry (G8)", () => {
    const err = expectThrowsMatching(
      () =>
        getParseManifest()({
          name: "demo",
          version: "1.0.0",
          registries: {
            contoso: { url: "http://example.com/apm" },
          },
        }),
      /contoso/i,
    );
    const msg = err instanceof Error ? err.message : String(err);
    expect(msg).toMatch(/insecure|http/i);
  });

  test("string-form remote http rejected naming registry (G8)", () => {
    const err = expectThrowsMatching(
      () =>
        getParseManifest()({
          name: "demo",
          version: "1.0.0",
          registries: {
            bare: "http://example.com/apm",
          },
        }),
      /bare/i,
    );
    const msg = err instanceof Error ? err.message : String(err);
    expect(msg).toMatch(/insecure|http/i);
  });

  test("loopback http allowed without insecure (G8)", () => {
    for (const url of [
      "http://127.0.0.1:8080/apm",
      "http://localhost/apm",
      "http://[::1]/apm",
    ]) {
      const doc = getParseManifest()({
        name: "demo",
        version: "1.0.0",
        registries: {
          local: { url },
        },
      });
      expect((doc.registries as Record<string, { url: string }>).local.url).toBe(url);
    }
  });

  test("RFC1918 http allowed without insecure (G8)", () => {
    for (const url of [
      "http://10.0.0.5/apm",
      "http://192.168.1.10/apm",
      "http://172.16.4.2/apm",
    ]) {
      const doc = getParseManifest()({
        name: "demo",
        version: "1.0.0",
        registries: {
          corp: { url },
        },
      });
      expect((doc.registries as Record<string, { url: string }>).corp.url).toBe(url);
    }
  });

  test("unknown registry key still rejected (mf-015)", () => {
    expectThrowsMatching(
      () =>
        getParseManifest()({
          name: "demo",
          version: "1.0.0",
          registries: {
            contoso: { url: "https://registry.example.com", token: "nope" },
          },
        }),
      /token|unknown/i,
    );

    expectThrowsMatching(
      () =>
        getParseManifest()({
          name: "demo",
          version: "1.0.0",
          registries: {
            contoso: { url: "https://registry.example.com", typo_key: true },
          },
        }),
      /unknown|typo_key/i,
    );
  });

  test("x-* vendor key still allowed alongside insecure", () => {
    const doc = getParseManifest()({
      name: "demo",
      version: "1.0.0",
      registries: {
        contoso: {
          url: "http://example.com/apm",
          insecure: true,
          "x-vendor-note": "ok",
        },
      },
    });
    const entry = (doc.registries as Record<string, Record<string, unknown>>).contoso;
    expect(entry.insecure).toBe(true);
    expect(entry["x-vendor-note"]).toBe("ok");
  });
});
