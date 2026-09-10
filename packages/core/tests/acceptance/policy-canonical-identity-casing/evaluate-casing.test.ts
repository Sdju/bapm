/**
 * req-pl-018 — policy allow/deny/require match under canonical identity casing.
 * Spec: openspec/.../specs/policy-rule-evaluate (Dependency policy identity casing).
 */
import { describe, expect, test } from "vite-plus/test";
import {
  getEvaluatePolicy,
  hasRuleViolation,
  isBlocking,
  parsePolicyDoc,
  violationsOf,
} from "./helpers.ts";

describe("policy-canonical-identity-casing — evaluate (req-pl-018)", () => {
  test("lowercase deny matches mixed-case GitHub identity (fail-closed)", () => {
    const policy = parsePolicyDoc({
      name: "org",
      enforcement: "block",
      dependencies: { deny: ["devexpgbb/**"] },
    });
    const result = getEvaluatePolicy()({
      policy,
      candidates: [{ id: "DevExpGbb/Secure-Baseline", host: "github.com" }],
      dependencies: ["DevExpGbb/Secure-Baseline"],
    });
    expect(violationsOf(result).length).toBeGreaterThanOrEqual(1);
    expect(hasRuleViolation(result, /deny|DevExpGbb\/Secure-Baseline|devexpgbb/i)).toBe(true);
    expect(isBlocking(result)).toBe(true);
  });

  test("mixed-case allow matches lowercased GitHub identity", () => {
    const policy = parsePolicyDoc({
      name: "org",
      enforcement: "block",
      dependencies: { allow: ["DevExpGbb/**"] },
    });
    const result = getEvaluatePolicy()({
      policy,
      candidates: [{ id: "devexpgbb/secure-baseline", host: "github.com" }],
      dependencies: ["devexpgbb/secure-baseline"],
    });
    expect(hasRuleViolation(result, /POLICY_ALLOW|not allowed|allow list/i)).toBe(false);
    expect(isBlocking(result)).toBe(false);
  });

  test("exact require is case-insensitive on GitHub coordinates", () => {
    const policy = parsePolicyDoc({
      name: "org",
      enforcement: "block",
      dependencies: { require: ["DevExpGbb/Secure-Baseline"] },
    });
    const result = getEvaluatePolicy()({
      policy,
      candidates: [{ id: "devexpgbb/secure-baseline", host: "github.com" }],
      dependencies: ["devexpgbb/secure-baseline"],
    });
    expect(hasRuleViolation(result, /POLICY_REQUIRE|required dependency|require/i)).toBe(false);
    expect(isBlocking(result)).toBe(false);
  });

  test("virtual path remains case-sensitive after repo-coordinate fold", () => {
    const policy = parsePolicyDoc({
      name: "org",
      enforcement: "block",
      dependencies: { allow: ["devexpgbb/secure-baseline/packages/**"] },
    });
    // Repo coords differ only by case; virtual path `Packages` ≠ `packages`.
    const result = getEvaluatePolicy()({
      policy,
      candidates: [
        {
          id: "DevExpGbb/Secure-Baseline/Packages/My-Skill",
          host: "github.com",
        },
      ],
      dependencies: ["DevExpGbb/Secure-Baseline/Packages/My-Skill"],
    });
    expect(hasRuleViolation(result, /POLICY_ALLOW|not allowed|allow list/i)).toBe(true);
    expect(isBlocking(result)).toBe(true);
  });

  test("repo-coordinate fold still allows matching virtual path when case agrees", () => {
    const policy = parsePolicyDoc({
      name: "org",
      enforcement: "block",
      dependencies: { allow: ["devexpgbb/secure-baseline/packages/**"] },
    });
    const result = getEvaluatePolicy()({
      policy,
      candidates: [
        {
          id: "DevExpGbb/Secure-Baseline/packages/My-Skill",
          host: "github.com",
        },
      ],
      dependencies: ["DevExpGbb/Secure-Baseline/packages/My-Skill"],
    });
    expect(hasRuleViolation(result, /POLICY_ALLOW|not allowed|allow list/i)).toBe(false);
    expect(isBlocking(result)).toBe(false);
  });

  test("case-sensitive host stays byte-exact (gitlab.com)", () => {
    const policy = parsePolicyDoc({
      name: "org",
      enforcement: "block",
      dependencies: { allow: ["devexpgbb/**"] },
    });
    const result = getEvaluatePolicy()({
      policy,
      candidates: [
        {
          id: "gitlab.com/DevExpGbb/Secure-Baseline",
          host: "gitlab.com",
        },
      ],
      dependencies: ["gitlab.com/DevExpGbb/Secure-Baseline"],
    });
    expect(hasRuleViolation(result, /POLICY_ALLOW|not allowed|allow list/i)).toBe(true);
    expect(isBlocking(result)).toBe(true);
  });

  test("registry source folds repository coordinates regardless of host", () => {
    const policy = parsePolicyDoc({
      name: "org",
      enforcement: "block",
      dependencies: { allow: ["devexpgbb/team/secure-baseline"] },
    });
    const result = getEvaluatePolicy()({
      policy,
      candidates: [
        {
          id: "DevExpGbb/Team/Secure-Baseline",
          source: "registry",
          host: "gitlab.com",
        },
      ],
      dependencies: [
        {
          id: "DevExpGbb/Team/Secure-Baseline",
          name: "DevExpGbb/Team/Secure-Baseline",
          source: "registry",
        },
      ],
    });
    expect(hasRuleViolation(result, /POLICY_ALLOW|not allowed|allow list/i)).toBe(false);
    expect(isBlocking(result)).toBe(false);
  });

  test("deny still wins after normalization", () => {
    const policy = parsePolicyDoc({
      name: "org",
      enforcement: "block",
      dependencies: {
        allow: ["DevExpGbb/**"],
        deny: ["devexpgbb/legacy"],
      },
    });
    const result = getEvaluatePolicy()({
      policy,
      candidates: [{ id: "DevExpGbb/Legacy", host: "github.com" }],
      dependencies: ["DevExpGbb/Legacy"],
    });
    expect(hasRuleViolation(result, /deny|POLICY_DENY|Legacy|legacy/i)).toBe(true);
    expect(isBlocking(result)).toBe(true);
  });

  test("require * is literal (not a glob) even under case fold", () => {
    const policy = parsePolicyDoc({
      name: "org",
      enforcement: "block",
      dependencies: { require: ["DevExpGbb/*"] },
    });
    const result = getEvaluatePolicy()({
      policy,
      candidates: [{ id: "devexpgbb/secure-baseline", host: "github.com" }],
      dependencies: ["devexpgbb/secure-baseline"],
    });
    // Exact require: package id must equal "DevExpGbb/*" (literal star), not glob-match.
    expect(hasRuleViolation(result, /POLICY_REQUIRE|required dependency|require/i)).toBe(true);
    expect(isBlocking(result)).toBe(true);
  });
});
