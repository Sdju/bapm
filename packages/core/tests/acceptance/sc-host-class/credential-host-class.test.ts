/**
 * sc-005 — Credential host-class = PSL eTLD+1 ∪ registries.*.aliases.
 * MUST NOT collapse via CNAME/SAN/redirect; last-2 approximation is insufficient.
 */
import { describe, expect, test } from "vite-plus/test";
import {
  getCredentialHostClassOf,
  getHostClassOf,
  getParseManifest,
  getSameCredentialHostClass,
} from "./helpers.ts";

describe("sc-host-class credential host-class (sc-005)", () => {
  test("same PSL eTLD+1 shares credential class (api.github.com ≡ github.com)", () => {
    const klass = getCredentialHostClassOf();
    const a = String(klass("api.github.com")).toLowerCase();
    const b = String(klass("github.com")).toLowerCase();
    expect(a.length).toBeGreaterThan(0);
    expect(a).toBe(b);
  });

  test("distinct eTLD+1 under multi-part public suffix do not share class", () => {
    const klass = getCredentialHostClassOf();
    // last-2 falsely collapses both to "co.uk"; PSL must keep example.co.uk ≠ other.co.uk
    const a = String(klass("a.example.co.uk")).toLowerCase();
    const b = String(klass("a.other.co.uk")).toLowerCase();
    expect(a).not.toBe(b);
    expect(a).toMatch(/example\.co\.uk/);
    expect(b).toMatch(/other\.co\.uk/);
  });

  test("github.io pages hosts are distinct per registrable domain (not last-2 github.io)", () => {
    const klass = getCredentialHostClassOf();
    const a = String(klass("alice.github.io")).toLowerCase();
    const b = String(klass("bob.github.io")).toLowerCase();
    expect(a).toBe("alice.github.io");
    expect(b).toBe("bob.github.io");
    expect(a).not.toBe(b);
  });

  test("aliases bind mirror host into registry url credential class", () => {
    const same = getSameCredentialHostClass();
    const registries = {
      pkgs: {
        url: "https://pkgs.example.com/v1",
        aliases: ["mirror.example.net"],
      },
    };
    expect(
      same("mirror.example.net", "pkgs.example.com", { registries }),
      "alias hostname must share credential class of registry url host",
    ).toBe(true);
    expect(
      same("mirror.example.net", "unrelated.evil.org", { registries }),
      "alias must not collapse unrelated hosts",
    ).toBe(false);
  });

  test("redirect observation alone does not collapse credential classes", () => {
    const same = getSameCredentialHostClass();
    // No aliases: distinct PSL classes remain distinct even if a redirect would link them.
    expect(same("pkgs.example.com", "cdn.other.net", { viaRedirect: true })).toBe(false);
  });

  test("manifest registries.*.aliases parse as string[] hostnames", () => {
    const parse = getParseManifest();
    const doc = parse({
      name: "demo/pkg",
      version: "1.0.0",
      registries: {
        pkgs: {
          url: "https://pkgs.example.com/v1",
          aliases: ["mirror.example.net", "alt.pkgs.example.com"],
        },
      },
      dependencies: { apm: [] },
    });
    const root = (doc as { document?: unknown }).document ?? doc;
    const registries =
      (root as { registries?: Record<string, { aliases?: unknown }> }).registries ??
      (root as { manifest?: { registries?: Record<string, { aliases?: unknown }> } }).manifest
        ?.registries;
    expect(registries, "expected parsed registries").toBeTruthy();
    const aliases = registries!.pkgs?.aliases;
    expect(Array.isArray(aliases), `aliases must be string[], got ${JSON.stringify(aliases)}`).toBe(
      true,
    );
    expect(aliases).toEqual(["mirror.example.net", "alt.pkgs.example.com"]);
    for (const a of aliases as unknown[]) {
      expect(typeof a).toBe("string");
    }
  });

  test("manifest registries.*.aliases reject non-string[] shapes", () => {
    const parse = getParseManifest();
    expect(() =>
      parse({
        name: "demo/pkg",
        version: "1.0.0",
        registries: {
          pkgs: {
            url: "https://pkgs.example.com/v1",
            aliases: "mirror.example.net",
          },
        },
        dependencies: { apm: [] },
      }),
    ).toThrow(/aliases/i);

    expect(() =>
      parse({
        name: "demo/pkg",
        version: "1.0.0",
        registries: {
          pkgs: {
            url: "https://pkgs.example.com/v1",
            aliases: [123, true],
          },
        },
        dependencies: { apm: [] },
      }),
    ).toThrow(/aliases/i);
  });

  test("policy hostClassOf unifies with PSL credential classifier for co.uk", () => {
    const hostClass = getHostClassOf();
    const a = String(hostClass({ url: "https://a.example.co.uk/policy" })).toLowerCase();
    const b = String(hostClass({ url: "https://a.other.co.uk/policy" })).toLowerCase();
    expect(a).not.toBe(b);
    expect(a).toMatch(/example\.co\.uk/);
  });
});
