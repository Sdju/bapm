/**
 * M8 policy YAML parse/validate — checklist C §1–7 + policy-yaml-parse.
 */
import { expect, test, describe } from "vite-plus/test";
import { expectThrowsMatching, getParsePolicy, policyOf, warningsOf } from "./helpers.ts";

describe("M8 parse — minimal + root shape", () => {
  test("minimal valid warn policy", () => {
    const result = getParsePolicy()({ name: "org", enforcement: "warn" });
    expect(String(policyOf(result).enforcement)).toBe("warn");
  });

  test("non-mapping root rejected (list)", () => {
    expectThrowsMatching(
      () => getParsePolicy()(["not", "a", "mapping"]),
      /mapping|object|root|invalid/i,
    );
  });

  test("non-mapping root rejected (scalar)", () => {
    expectThrowsMatching(() => getParsePolicy()("scalar"), /mapping|object|root|invalid/i);
  });
});

describe("M8 parse — enforcement coerce + reject", () => {
  test("YAML bool off becomes string off", () => {
    // Mimic YAML parse of unquoted `off` → boolean false (APM coerce to "off").
    const result = getParsePolicy()({ name: "org", enforcement: false });
    expect(String(policyOf(result).enforcement)).toBe("off");
  });

  test("invalid enforcement rejected", () => {
    expectThrowsMatching(
      () => getParsePolicy()({ name: "org", enforcement: "hard" }),
      /enforcement|invalid|hard|enum/i,
    );
  });
});

describe("M8 parse — unknown TL + x-* (pl-009)", () => {
  test("unknown top-level warns, still succeeds", () => {
    const result = getParsePolicy()({
      name: "org",
      enforcement: "warn",
      future_key: 1,
    });
    const warnings = warningsOf(result);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    const text = JSON.stringify(warnings);
    expect(text).toMatch(/future_key/);
    expect(String(policyOf(result).enforcement)).toBe("warn");
  });

  test("x-acme-foo preserved silently", () => {
    const result = getParsePolicy()({
      name: "org",
      enforcement: "warn",
      "x-acme-foo": "bar",
    });
    const doc = policyOf(result);
    const warnings = warningsOf(result);
    const warnText = JSON.stringify(warnings);
    expect(warnText).not.toMatch(/x-acme-foo/);
    const ext =
      doc["x-acme-foo"] ??
      (doc.extensions as Record<string, unknown> | undefined)?.["x-acme-foo"] ??
      (doc.x as Record<string, unknown> | undefined)?.["acme-foo"];
    expect(ext).toBe("bar");
  });
});

describe("M8 parse — tri-state allow (pl-005)", () => {
  test("omit vs null vs [] vs populated distinguishable", () => {
    const parse = getParsePolicy();
    const omitted = policyOf(parse({ name: "a", enforcement: "warn" }));
    const nulled = policyOf(
      parse({ name: "b", enforcement: "warn", dependencies: { allow: null } }),
    );
    const empty = policyOf(parse({ name: "c", enforcement: "warn", dependencies: { allow: [] } }));
    const populated = policyOf(
      parse({
        name: "d",
        enforcement: "warn",
        dependencies: { allow: ["org/*"] },
      }),
    );

    const allowOf = (doc: Record<string, unknown>) => {
      const deps = doc.dependencies as Record<string, unknown> | undefined;
      return deps?.allow;
    };

    const aOmit = allowOf(omitted);
    const aNull = allowOf(nulled);
    const aEmpty = allowOf(empty);
    const aPop = allowOf(populated);

    // Transparent: omit and null both unset (undefined/null), not [].
    expect(aOmit == null).toBe(true);
    expect(aNull == null).toBe(true);
    expect(Array.isArray(aEmpty)).toBe(true);
    expect((aEmpty as unknown[]).length).toBe(0);
    expect(Array.isArray(aPop)).toBe(true);
    expect(aPop).toEqual(["org/*"]);
  });
});

describe("M8 parse — dependencies fields for evaluate", () => {
  test("dependencies deny + require_pinned_constraint load", () => {
    const result = getParsePolicy()({
      name: "org",
      enforcement: "block",
      dependencies: {
        deny: ["org/legacy"],
        require_pinned_constraint: true,
        max_depth: 3,
        require: ["org/base"],
      },
    });
    const deps = policyOf(result).dependencies as Record<string, unknown>;
    expect(deps.deny).toEqual(["org/legacy"]);
    expect(deps.require_pinned_constraint).toBe(true);
    expect(deps.max_depth).toBe(3);
    expect(deps.require).toEqual(["org/base"]);
  });
});
