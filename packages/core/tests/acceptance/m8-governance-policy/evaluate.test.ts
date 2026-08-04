/**
 * M8 policy rule evaluate — checklist C §8–11, 20–22 + policy-rule-evaluate.
 */
import { expect, test, describe } from "vite-plus/test";
import {
  getEvaluatePolicy,
  getParsePolicy,
  isBlocking,
  policyOf,
  violationsOf,
  warningsOf,
} from "./helpers.ts";

function parse(doc: Record<string, unknown>): Record<string, unknown> {
  return policyOf(getParsePolicy()(doc));
}

describe("M8 evaluate — deny / require / pinned / depth", () => {
  test("deny wins over allow for org/legacy", () => {
    const policy = parse({
      name: "org",
      enforcement: "block",
      dependencies: {
        allow: ["org/*"],
        deny: ["org/legacy"],
      },
    });
    const result = getEvaluatePolicy()({
      policy,
      candidates: [{ id: "org/legacy" }, { id: "org/ok" }],
      dependencies: ["org/legacy", "org/ok"],
    });
    expect(violationsOf(result).length + warningsOf(result).length).toBeGreaterThanOrEqual(1);
    const text = JSON.stringify(result);
    expect(text).toMatch(/org\/legacy|deny/i);
    expect(isBlocking(result)).toBe(true);
  });

  test("require missing is a violation", () => {
    const policy = parse({
      name: "org",
      enforcement: "block",
      dependencies: { require: ["org/base"] },
    });
    const result = getEvaluatePolicy()({
      policy,
      candidates: [{ id: "org/other" }],
      dependencies: ["org/other"],
    });
    expect(violationsOf(result).length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(result)).toMatch(/org\/base|require/i);
    expect(isBlocking(result)).toBe(true);
  });

  test("require_pinned_constraint: star violates; 40-hex OK", () => {
    const policy = parse({
      name: "org",
      enforcement: "block",
      dependencies: { require_pinned_constraint: true },
    });
    const star = getEvaluatePolicy()({
      policy,
      candidates: [{ id: "org/a", ref: "*", constraint: "*", direct: true }],
      dependencies: [{ name: "org/a", ref: "*", direct: true }],
    });
    expect(violationsOf(star).length).toBeGreaterThanOrEqual(1);
    expect(isBlocking(star)).toBe(true);

    const sha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const pinned = getEvaluatePolicy()({
      policy,
      candidates: [{ id: "org/a", ref: sha, constraint: sha, direct: true }],
      dependencies: [{ name: "org/a", ref: sha, direct: true }],
    });
    const pinText = JSON.stringify(pinned);
    expect(pinText).not.toMatch(/pinned-constraint|unbounded|require_pinned/i);
    expect(isBlocking(pinned)).toBe(false);
  });

  test("max_depth exceeded is a violation", () => {
    const policy = parse({
      name: "org",
      enforcement: "block",
      dependencies: { max_depth: 1 },
    });
    const result = getEvaluatePolicy()({
      policy,
      candidates: [
        { id: "root", depth: 0 },
        { id: "child", depth: 1 },
        { id: "grandchild", depth: 2 },
      ],
      graphDepth: 2,
      maxDepthObserved: 2,
    });
    expect(violationsOf(result).length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(result)).toMatch(/max_?depth|depth/i);
    expect(isBlocking(result)).toBe(true);
  });
});

describe("M8 evaluate — enforcement modes", () => {
  const denyPolicy = (enforcement: string) =>
    parse({
      name: "org",
      enforcement,
      dependencies: { deny: ["org/legacy"] },
    });

  test("block + violation → blocking", () => {
    const result = getEvaluatePolicy()({
      policy: denyPolicy("block"),
      candidates: [{ id: "org/legacy" }],
      dependencies: ["org/legacy"],
    });
    expect(isBlocking(result)).toBe(true);
  });

  test("warn + violation → non-blocking warnings", () => {
    const result = getEvaluatePolicy()({
      policy: denyPolicy("warn"),
      candidates: [{ id: "org/legacy" }],
      dependencies: ["org/legacy"],
    });
    expect(isBlocking(result)).toBe(false);
    expect(warningsOf(result).length + violationsOf(result).length).toBeGreaterThanOrEqual(1);
  });

  test("off → checks do not block", () => {
    const result = getEvaluatePolicy()({
      policy: denyPolicy("off"),
      candidates: [{ id: "org/legacy" }],
      dependencies: ["org/legacy"],
    });
    expect(isBlocking(result)).toBe(false);
  });
});
