/**
 * Unit: insecure dual-consent + host allowlist helpers (p7a).
 */
import { describe, expect, test } from "vite-plus/test";
import {
  enforceInsecurePolicy,
  formatInsecureDependencyRequirements,
  isHttpInsecureUrl,
  isValidFqdn,
  normalizeAllowInsecureHost,
} from "../../src/modules/Install/insecurePolicy.ts";
import { InstallError } from "../../src/modules/Install/errors.ts";

describe("insecurePolicy helpers", () => {
  test("classifies http:// as insecure; https not", () => {
    expect(isHttpInsecureUrl("http://mirror.example.com/pkg.git")).toBe(true);
    expect(isHttpInsecureUrl("https://mirror.example.com/pkg.git")).toBe(false);
  });

  test("dual-consent: missing CLI only asks for --allow-insecure", () => {
    const msg = formatInsecureDependencyRequirements("http://x.example/a.git", {
      missingDepAllow: false,
      missingCliFlag: true,
    });
    expect(msg).toMatch(/--allow-insecure/);
    expect(msg).not.toMatch(/Set allow_insecure:\s*true/);
  });

  test("dual-consent: missing manifest asks for allow_insecure: true", () => {
    const msg = formatInsecureDependencyRequirements("http://x.example/a.git", {
      missingDepAllow: true,
      missingCliFlag: false,
    });
    expect(msg).toMatch(/allow_insecure:\s*true/);
  });

  test("enforce blocks direct without dual consent", () => {
    expect(() =>
      enforceInsecurePolicy({
        infos: [
          {
            url: "http://mirror.example.com/direct.git",
            isTransitive: false,
            allowInsecure: true,
          },
        ],
        allowInsecure: false,
        allowInsecureHosts: [],
      }),
    ).toThrow(InstallError);
  });

  test("enforce blocks transitive host without allowlist", () => {
    expect(() =>
      enforceInsecurePolicy({
        infos: [
          {
            url: "http://evil.example.com/child.git",
            isTransitive: true,
            introducedBy: "parent",
          },
        ],
        allowInsecure: false,
        allowInsecureHosts: [],
      }),
    ).toThrow(/--allow-insecure-host|evil\.example\.com/);
  });

  test("allow-insecure-host permits transitive host", () => {
    const { warnings } = enforceInsecurePolicy({
      infos: [
        {
          url: "http://mirror.example.com/child.git",
          isTransitive: true,
          introducedBy: "parent",
        },
      ],
      allowInsecure: false,
      allowInsecureHosts: ["mirror.example.com"],
    });
    expect(warnings.some((w) => /Insecure HTTP|unencrypted/i.test(w))).toBe(true);
  });

  test("invalid hostname rejected", () => {
    expect(isValidFqdn("not a host")).toBe(false);
    expect(() => normalizeAllowInsecureHost("not a host")).toThrow(
      /Invalid hostname|FQDN|bare hostname/,
    );
  });
});
