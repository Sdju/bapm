/**
 * Unit: req-pl-018 match-time fold + req-rs-016 identity casing.
 */
import { describe, expect, test } from "vite-plus/test";
import * as core from "@b-apm/core";

const c = core as Record<string, unknown>;

function fn<T extends (...args: never[]) => unknown>(names: string[]): T {
  for (const name of names) {
    if (typeof c[name] === "function") return c[name] as T;
  }
  throw new TypeError(`expected export one of [${names.join(", ")}]`);
}

const identityMatchesPattern = fn<
  (identity: string, pattern: string, options?: Record<string, unknown>) => boolean
>(["identityMatchesPattern"]);
const identitySatisfiesRequire = fn<
  (identity: string, pattern: string, options?: Record<string, unknown>) => boolean
>(["identitySatisfiesRequire"]);
const foldRepoCoordinatePath = fn<(value: string, options?: Record<string, unknown>) => string>([
  "foldRepoCoordinatePath",
]);
const isCaseInsensitiveGitHost = fn<(host: string, options?: Record<string, unknown>) => boolean>([
  "isCaseInsensitiveGitHost",
]);
const isCaseInsensitivePackageIdentity = fn<(options?: Record<string, unknown>) => boolean>([
  "isCaseInsensitivePackageIdentity",
]);
const normalizePackageRepoUrl = fn<(repoUrl: string, options?: Record<string, unknown>) => string>([
  "normalizePackageRepoUrl",
  "normalizeLockPackageRepoUrl",
]);
const normalizePackageRepoPath = fn<(repoUrl: string, options?: Record<string, unknown>) => string>(
  ["normalizePackageRepoPath"],
);
const normalizeRepoIdentity = fn<(repoUrl: string) => string>(["normalizeRepoIdentity"]);

describe("repoIdentityCase — host / source disclosure", () => {
  test("github.com / *.ghe.com / GITHUB_HOST fold; gitlab does not", () => {
    expect(isCaseInsensitiveGitHost("github.com")).toBe(true);
    expect(isCaseInsensitiveGitHost("GitHub.com")).toBe(true);
    expect(isCaseInsensitiveGitHost("acme.ghe.com")).toBe(true);
    expect(isCaseInsensitiveGitHost("ghe.example.com", { githubHostEnv: "ghe.example.com" })).toBe(
      true,
    );
    expect(isCaseInsensitiveGitHost("gitlab.com")).toBe(false);
    expect(isCaseInsensitiveGitHost("gitlab.com", { githubHostEnv: "ghe.example.com" })).toBe(
      false,
    );
  });

  test("registry always folds; local/marketplace never", () => {
    expect(isCaseInsensitivePackageIdentity({ source: "registry", host: "gitlab.com" })).toBe(true);
    expect(isCaseInsensitivePackageIdentity({ source: "local" })).toBe(false);
    expect(isCaseInsensitivePackageIdentity({ source: "marketplace" })).toBe(false);
  });
});

describe("policy match — req-pl-018 casing", () => {
  test("lowercase deny matches mixed-case GitHub identity", () => {
    expect(
      identityMatchesPattern("DevExpGbb/Secure-Baseline", "devexpgbb/**", {
        host: "github.com",
      }),
    ).toBe(true);
  });

  test("mixed-case allow matches lowercased GitHub identity", () => {
    expect(
      identityMatchesPattern("devexpgbb/secure-baseline", "DevExpGbb/**", {
        host: "github.com",
      }),
    ).toBe(true);
  });

  test("exact require folds GitHub coordinates; * stays literal", () => {
    expect(
      identitySatisfiesRequire("devexpgbb/secure-baseline", "DevExpGbb/Secure-Baseline", {
        host: "github.com",
      }),
    ).toBe(true);
    expect(
      identitySatisfiesRequire("devexpgbb/secure-baseline", "DevExpGbb/*", {
        host: "github.com",
      }),
    ).toBe(false);
  });

  test("virtual path remains case-sensitive after repo-coordinate fold", () => {
    expect(
      identityMatchesPattern(
        "DevExpGbb/Secure-Baseline/Packages/My-Skill",
        "devexpgbb/secure-baseline/packages/**",
        { host: "github.com" },
      ),
    ).toBe(false);
    expect(
      identityMatchesPattern(
        "DevExpGbb/Secure-Baseline/packages/My-Skill",
        "devexpgbb/secure-baseline/packages/**",
        { host: "github.com" },
      ),
    ).toBe(true);
  });

  test("gitlab.com stays byte-exact", () => {
    expect(
      identityMatchesPattern("gitlab.com/DevExpGbb/Secure-Baseline", "devexpgbb/**", {
        host: "gitlab.com",
      }),
    ).toBe(false);
  });

  test("registry folds regardless of host", () => {
    expect(
      identityMatchesPattern("DevExpGbb/Team/Secure-Baseline", "devexpgbb/team/secure-baseline", {
        source: "registry",
        host: "gitlab.com",
      }),
    ).toBe(true);
  });

  test("deny pattern matches after fold (deny-wins subject)", () => {
    expect(
      identityMatchesPattern("DevExpGbb/Legacy", "devexpgbb/legacy", { host: "github.com" }),
    ).toBe(true);
  });

  test("fold truncates before ** segment", () => {
    expect(foldRepoCoordinatePath("DevExpGbb/**", { host: "github.com", isPattern: true })).toBe(
      "devexpgbb/**",
    );
    expect(
      foldRepoCoordinatePath("DevExpGbb/Secure-Baseline/Packages/X", { host: "github.com" }),
    ).toBe("devexpgbb/secure-baseline/Packages/X");
  });

  test("omit options → byte-exact (merge path)", () => {
    expect(identityMatchesPattern("DevExpGbb/Legacy", "devexpgbb/legacy")).toBe(false);
    expect(identityMatchesPattern("DevExpGbb/**", "devexpgbb/secure-baseline")).toBe(false);
  });
});

describe("Resolver / Lockfile identity keys", () => {
  test("GitHub path case folds into one identity key", () => {
    const mixed = normalizeRepoIdentity("https://github.com/DevExpGbb/Secure-Baseline.git");
    const lower = normalizeRepoIdentity("https://github.com/devexpgbb/secure-baseline");
    expect(mixed).toBe(lower);
    expect(mixed).toBe(mixed.toLowerCase());
  });

  test("unknown host path case remains distinct; host case folds", () => {
    expect(normalizeRepoIdentity("https://gitlab.com/DevExpGbb/Secure-Baseline")).not.toBe(
      normalizeRepoIdentity("https://gitlab.com/devexpgbb/secure-baseline"),
    );
    expect(normalizeRepoIdentity("https://GitLab.com/Acme/Repo")).toBe(
      normalizeRepoIdentity("https://gitlab.com/Acme/Repo"),
    );
  });

  test("registry-sourced package identity folds path case", () => {
    expect(normalizePackageRepoUrl("DevExpGbb/Team/Secure-Baseline", { source: "registry" })).toBe(
      "devexpgbb/team/secure-baseline",
    );
    expect(normalizePackageRepoPath("DevExpGbb/X", { source: "registry" })).toBe("devexpgbb/x");
  });
});
