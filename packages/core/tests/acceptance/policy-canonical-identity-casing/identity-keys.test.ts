/**
 * req-rs-016 clause 3 — resolve/cache identity path casing aligned with policy fold.
 * Spec: openspec/.../specs/dependency-resolve.
 */
import { describe, expect, test } from "vite-plus/test";
import { getNormalizeRepoIdentity, tryNormalizePackageRepoUrl } from "./helpers.ts";

describe("policy-canonical-identity-casing — identity keys (req-rs-016)", () => {
  test("GitHub path case folds into one identity key", () => {
    const normalize = getNormalizeRepoIdentity();
    const mixed = normalize("https://github.com/DevExpGbb/Secure-Baseline.git");
    const lower = normalize("https://github.com/devexpgbb/secure-baseline");
    expect(mixed).toBe(lower);
    expect(mixed.toLowerCase()).toBe(mixed);
  });

  test("github.com shorthand owner/repo folds path case", () => {
    const normalize = getNormalizeRepoIdentity();
    expect(normalize("DevExpGbb/Secure-Baseline")).toBe(normalize("devexpgbb/secure-baseline"));
  });

  test("unknown host path case remains distinct", () => {
    const normalize = getNormalizeRepoIdentity();
    const a = normalize("https://gitlab.com/DevExpGbb/Secure-Baseline");
    const b = normalize("https://gitlab.com/devexpgbb/secure-baseline");
    expect(a).not.toBe(b);
  });

  test("host case still folds while path case is preserved on unknown hosts", () => {
    const normalize = getNormalizeRepoIdentity();
    const a = normalize("https://GitLab.com/Acme/Repo");
    const b = normalize("https://gitlab.com/Acme/Repo");
    expect(a).toBe(b);
  });

  test("registry-sourced package identity folds path case when helper is exported", () => {
    const normalizePkg = tryNormalizePackageRepoUrl();
    if (!normalizePkg) {
      // Apply must export or share the disclosed rule via normalizeRepoIdentity + source.
      // Soft-skip only the Lockfile-named export; Resolver GitHub fold above remains RED.
      expect(normalizePkg).toBeTypeOf("function");
      return;
    }
    const mixed = normalizePkg("DevExpGbb/Team/Secure-Baseline", { source: "registry" });
    const lower = normalizePkg("devexpgbb/team/secure-baseline", { source: "registry" });
    expect(mixed).toBe(lower);
    expect(mixed).toBe(mixed.toLowerCase());
  });
});
