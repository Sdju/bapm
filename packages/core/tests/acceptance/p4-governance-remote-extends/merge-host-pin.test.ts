/**
 * P4 — pl-006 §6.4 merge for gate families + pl-004 host-class pin.
 */
import { describe, expect, test } from "vite-plus/test";
import {
  expectThrowsMatching,
  getHostClassOf,
  getMergePolicies,
  getResolvePolicyChain,
  policyOf,
} from "./helpers.ts";

describe("P4 merge — OpenAPM §6.4 gate families (pl-006)", () => {
  test("stricter enforcement wins (warn parent + block child → block)", () => {
    const merge = getMergePolicies();
    const effective = policyOf(
      merge(
        { name: "parent", enforcement: "warn", fetch_failure: "warn" },
        { name: "child", enforcement: "block", fetch_failure: "block" },
      ),
    );
    expect(String(effective.enforcement)).toBe("block");
  });

  test("allow lists intersect", () => {
    const merge = getMergePolicies();
    const effective = policyOf(
      merge(
        {
          name: "parent",
          enforcement: "warn",
          dependencies: { allow: ["org/*", "other/*"] },
        },
        {
          name: "child",
          enforcement: "warn",
          dependencies: { allow: ["org/a"] },
        },
      ),
    );
    const allow = (effective.dependencies as { allow?: string[] } | undefined)?.allow ?? [];
    const text = JSON.stringify(allow);
    expect(text).toMatch(/org\/a|org\/\*/);
    // Intersection must not keep unrelated parent-only patterns unchecked.
    expect(allow.map(String).some((p) => p === "other/*")).toBe(false);
  });

  test("max_depth takes minimum", () => {
    const merge = getMergePolicies();
    const effective = policyOf(
      merge(
        { name: "parent", enforcement: "warn", dependencies: { max_depth: 10 } },
        { name: "child", enforcement: "warn", dependencies: { max_depth: 5 } },
      ),
    );
    const deps = effective.dependencies as { max_depth?: number } | undefined;
    expect(Number(deps?.max_depth)).toBe(5);
  });

  test("fetch_failure child overrides if set", () => {
    const merge = getMergePolicies();
    const effective = policyOf(
      merge(
        { name: "parent", enforcement: "warn", fetch_failure: "block" },
        { name: "child", enforcement: "warn", fetch_failure: "warn" },
      ),
    );
    expect(String(effective.fetch_failure)).toBe("warn");
  });
});

describe("P4 host-class pin (pl-004)", () => {
  test("same host-class extends allowed", () => {
    const hostClass = getHostClassOf();
    const a = String(hostClass({ url: "https://github.com/acme/policy" }));
    const b = String(hostClass({ url: "https://github.com/other/policy" }));
    expect(a).toBe(b);

    const resolve = getResolvePolicyChain();
    const leaf = {
      name: "leaf",
      enforcement: "block",
      extends: "https://github.com/acme/parent-policy",
    };
    const parent = { name: "parent", enforcement: "warn" };
    const result = resolve({
      leaf,
      document: leaf,
      fetchAncestor: () => ({ document: parent, policy: parent }),
      leafHostClass: a,
    });
    expect(policyOf(result).name).toBeTruthy();
  });

  test("cross-host-class extends rejected", () => {
    const hostClass = getHostClassOf();
    const gh = String(hostClass({ url: "https://github.com/acme/policy" }));
    const gl = String(hostClass({ url: "https://gitlab.com/acme/policy" }));
    expect(gh).not.toBe(gl);

    const leaf = {
      name: "leaf",
      enforcement: "block",
      extends: "https://gitlab.com/acme/parent-policy",
    };
    expectThrowsMatching(
      () =>
        getResolvePolicyChain()({
          leaf,
          document: leaf,
          leafHostClass: gh,
          fetchAncestor: () => ({
            document: { name: "parent", enforcement: "warn" },
            policy: { name: "parent", enforcement: "warn" },
            hostClass: gl,
            url: "https://gitlab.com/acme/parent-policy",
          }),
        }),
      /host.?class|cross.?host|pin|host class/i,
    );
  });
});
