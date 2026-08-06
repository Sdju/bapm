/**
 * Unit: registries insecure + http gate matrix (sc-006).
 */
import { describe, expect, test } from "vite-plus/test";
import { parseManifest } from "../../src/modules/Manifest/parse.ts";
import { isExemptInsecureHost } from "../../src/modules/Manifest/registryUrl.ts";
import { ManifestError } from "../../src/modules/Manifest/errors.ts";

describe("isExemptInsecureHost", () => {
  test("loopback and localhost", () => {
    expect(isExemptInsecureHost("localhost")).toBe(true);
    expect(isExemptInsecureHost("127.0.0.1")).toBe(true);
    expect(isExemptInsecureHost("127.0.0.2")).toBe(true);
    expect(isExemptInsecureHost("::1")).toBe(true);
    expect(isExemptInsecureHost("[::1]")).toBe(true);
  });

  test("RFC1918", () => {
    expect(isExemptInsecureHost("10.0.0.5")).toBe(true);
    expect(isExemptInsecureHost("192.168.1.10")).toBe(true);
    expect(isExemptInsecureHost("172.16.4.2")).toBe(true);
    expect(isExemptInsecureHost("172.31.255.255")).toBe(true);
    expect(isExemptInsecureHost("172.15.0.1")).toBe(false);
    expect(isExemptInsecureHost("172.32.0.1")).toBe(false);
  });

  test("public hosts not exempt", () => {
    expect(isExemptInsecureHost("example.com")).toBe(false);
    expect(isExemptInsecureHost("8.8.8.8")).toBe(false);
  });
});

describe("validateRegistries insecure matrix", () => {
  test("https ok; remote http needs insecure; loopback exempt", () => {
    expect(
      parseManifest({
        name: "d",
        version: "1.0.0",
        registries: { a: { url: "https://reg.example.com" } },
      }).registries,
    ).toBeTruthy();

    expect(
      parseManifest({
        name: "d",
        version: "1.0.0",
        registries: { a: { url: "http://example.com", insecure: true } },
      }).registries?.a,
    ).toMatchObject({ insecure: true });

    expect(
      parseManifest({
        name: "d",
        version: "1.0.0",
        registries: { local: { url: "http://127.0.0.1:9/apm" } },
      }).registries?.local,
    ).toMatchObject({ url: "http://127.0.0.1:9/apm" });
  });

  test("loopback http allowed without insecure (localhost / ::1)", () => {
    for (const url of [
      "http://127.0.0.1:8080/apm",
      "http://localhost/apm",
      "http://[::1]/apm",
    ]) {
      const doc = parseManifest({
        name: "demo",
        version: "1.0.0",
        registries: { local: { url } },
      });
      expect(doc.registries?.local).toMatchObject({ url });
    }
  });

  test("RFC1918 http allowed without insecure", () => {
    for (const url of [
      "http://10.0.0.5/apm",
      "http://192.168.1.10/apm",
      "http://172.16.4.2/apm",
    ]) {
      const doc = parseManifest({
        name: "demo",
        version: "1.0.0",
        registries: { corp: { url } },
      });
      expect(doc.registries?.corp).toMatchObject({ url });
    }
  });

  test("remote http without insecure names registry", () => {
    try {
      parseManifest({
        name: "d",
        version: "1.0.0",
        registries: { contoso: { url: "http://example.com/apm" } },
      });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ManifestError);
      expect((e as Error).message).toMatch(/contoso/i);
      expect((e as Error).message).toMatch(/insecure|http/i);
    }
  });

  test("string-form remote http rejected", () => {
    expect(() =>
      parseManifest({
        name: "d",
        version: "1.0.0",
        registries: { bare: "http://example.com/apm" },
      }),
    ).toThrow(/bare/i);
  });

  test("unknown keys still rejected; insecure allowed", () => {
    expect(() =>
      parseManifest({
        name: "d",
        version: "1.0.0",
        registries: { a: { url: "https://x.example", token: "no" } },
      }),
    ).toThrow(/token/i);

    expect(() =>
      parseManifest({
        name: "d",
        version: "1.0.0",
        registries: { a: { url: "https://x.example", typo_key: true } },
      }),
    ).toThrow(/unknown|typo_key/i);
  });

  test("x-* vendor key allowed alongside insecure", () => {
    const doc = parseManifest({
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
    expect(doc.registries?.contoso).toMatchObject({
      insecure: true,
      "x-vendor-note": "ok",
    });
  });
});
