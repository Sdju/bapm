/**
 * Section 6.4 merge stays byte-exact — folding MUST NOT run during merge (req-pl-018).
 * Promoted from acceptance/policy-canonical-identity-casing.
 */
import { describe, expect, test } from "vite-plus/test";
import { allowListOf, denyListOf, getMergePolicies, getParsePolicy, policyOf } from "./helpers.ts";

function parsePolicyDoc(doc: Record<string, unknown>): Record<string, unknown> {
  return policyOf(getParsePolicy()(doc));
}

describe("merge — identity casing byte-exact", () => {
  test("deny union keeps authored case variants distinct (no fold-dedupe)", () => {
    const parent = parsePolicyDoc({
      name: "parent",
      enforcement: "warn",
      dependencies: { deny: ["DevExpGbb/Legacy"] },
    });
    const child = parsePolicyDoc({
      name: "child",
      enforcement: "block",
      dependencies: { deny: ["devexpgbb/legacy"] },
    });
    const effective = policyOf(getMergePolicies()(parent, child));
    const deny = denyListOf(effective);
    expect(deny).toContain("DevExpGbb/Legacy");
    expect(deny).toContain("devexpgbb/legacy");
    expect(deny.length).toBe(2);
  });

  test("allow intersection does not treat fold-equivalent patterns as compatible", () => {
    const parent = parsePolicyDoc({
      name: "parent",
      enforcement: "block",
      dependencies: { allow: ["DevExpGbb/**"] },
    });
    const child = parsePolicyDoc({
      name: "child",
      enforcement: "block",
      dependencies: { allow: ["devexpgbb/secure-baseline"] },
    });
    const effective = policyOf(getMergePolicies()(parent, child));
    const allow = allowListOf(effective);
    // Byte-exact §6.4: child concrete is not covered by parent glob without fold.
    expect(allow).not.toContain("devexpgbb/secure-baseline");
  });
});
