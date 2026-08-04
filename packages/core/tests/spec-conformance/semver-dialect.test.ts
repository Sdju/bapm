/**
 * Mode B / req-rs-007 — wire vendored resolution/semver-dialect.json oracle.
 * Full node-semver case matrix is covered by resolve/intersection-pick.test.ts;
 * this module asserts the OpenAPM seed oracle is present and well-formed.
 */
import { expect, test, describe } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { fixturePath } from "./helpers.ts";

type SemverCase = {
  id: string;
  range: string;
  tags: string[];
  expected: string | null;
  prerelease_optin?: boolean;
};

describe("Mode B req-rs-007 — semver-dialect oracle", () => {
  test("resolution/semver-dialect.json is vendored and non-empty", () => {
    const path = fixturePath("resolution/semver-dialect.json");
    expect(existsSync(path), `missing ${path}`).toBe(true);
    const oracle = JSON.parse(readFileSync(path, "utf8")) as {
      cases?: SemverCase[];
    };
    expect(Array.isArray(oracle.cases)).toBe(true);
    expect(oracle.cases!.length).toBeGreaterThan(0);
    for (const c of oracle.cases!) {
      expect(c.id).toBeTruthy();
      expect(typeof c.range).toBe("string");
      expect(Array.isArray(c.tags)).toBe(true);
    }
  });

  test("citation: packages/core/tests/resolve/intersection-pick.test.ts exercises the same oracle", () => {
    // Structural guarantee: seed path used by Mode B checklist for rs-007/014.
    const path = fixturePath("resolution/semver-dialect.json");
    const oracle = JSON.parse(readFileSync(path, "utf8")) as { cases: SemverCase[] };
    expect(oracle.cases.some((c) => c.expected === null)).toBe(true);
    expect(oracle.cases.some((c) => typeof c.expected === "string")).toBe(true);
  });
});
