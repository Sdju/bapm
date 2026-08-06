/**
 * Typed policy executables.deny_all / deny parse + merge OR/∪ (sc-011).
 * Promoted from sc-executable-governance acceptance.
 */
import { describe, expect, test } from "vite-plus/test";
import { getMergePolicies, getParsePolicy, policyOf, warningsOf } from "./helpers.ts";

type PolicyWarning = { code?: string; message?: string; path?: string };

function asWarnings(result: unknown): PolicyWarning[] {
  return warningsOf(result) as PolicyWarning[];
}

describe("policy executables parse/merge (sc-011)", () => {
  test("deny_all and deny parse without pl-009 on executables", () => {
    const parse = getParsePolicy();
    const result = parse({
      name: "org",
      enforcement: "warn",
      executables: { deny_all: false, deny: ["org/blocked"] },
    });
    const doc = policyOf(result);
    const ex = doc.executables as { deny_all?: boolean; deny?: string[] } | undefined;
    expect(ex, "typed executables must be exposed on policy model").toBeTruthy();
    expect(ex?.deny_all).toBe(false);
    expect(ex?.deny).toEqual(expect.arrayContaining(["org/blocked"]));

    const warnText = JSON.stringify(asWarnings(result));
    expect(warnText).not.toMatch(/PL_009_UNKNOWN_KEY.*"executables"|Unknown top-level policy key "executables"/i);
    expect(
      asWarnings(result).some(
        (w) =>
          /PL_009|unknown/i.test(String(w.code ?? "")) &&
          String(w.path ?? w.message ?? "").includes("executables"),
      ),
    ).toBe(false);
  });

  test("deny_all true parses", () => {
    const parse = getParsePolicy();
    const result = parse({
      name: "org",
      enforcement: "warn",
      executables: { deny_all: true },
    });
    const ex = policyOf(result).executables as { deny_all?: boolean } | undefined;
    expect(ex?.deny_all).toBe(true);
  });

  test("unknown top-level still pl-009 alongside valid executables", () => {
    const parse = getParsePolicy();
    const result = parse({
      name: "org",
      enforcement: "warn",
      executables: { deny_all: false, deny: ["org/a"] },
      future_key: 1,
    });
    expect(asWarnings(result).some((w) => /PL_009|unknown/i.test(String(w.code ?? w.message)))).toBe(
      true,
    );
    expect(JSON.stringify(asWarnings(result))).toMatch(/future_key/);
  });

  test("deny_all OR across extends (parent true wins over child false)", () => {
    const merge = getMergePolicies();
    const merged = merge(
      {
        name: "parent",
        enforcement: "warn",
        fetch_failure: "warn",
        executables: { deny_all: true, deny: ["org/a"] },
      },
      {
        name: "leaf",
        enforcement: "warn",
        fetch_failure: "warn",
        executables: { deny_all: false, deny: ["org/b"] },
      },
    );
    const ex = policyOf(merged).executables as { deny_all?: boolean; deny?: string[] } | undefined;
    expect(ex?.deny_all, "deny_all must OR across extends").toBe(true);
    expect(ex?.deny).toEqual(expect.arrayContaining(["org/a", "org/b"]));
  });

  test("deny lists union across extends", () => {
    const merge = getMergePolicies();
    const merged = merge(
      {
        name: "parent",
        enforcement: "warn",
        fetch_failure: "warn",
        executables: { deny: ["org/a"] },
      },
      {
        name: "leaf",
        enforcement: "warn",
        fetch_failure: "warn",
        executables: { deny: ["org/b"] },
      },
    );
    const ex = policyOf(merged).executables as { deny?: string[] } | undefined;
    expect(ex?.deny).toEqual(expect.arrayContaining(["org/a", "org/b"]));
  });
});
