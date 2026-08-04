/**
 * p3: vendored OpenAPM §12.4 seed fixtures at tests/fixtures/spec-conformance/
 * (must not require `.samples/apm`).
 */
import { expect, test, describe } from "vite-plus/test";
import { existsSync } from "node:fs";
import {
  REQUIRED_FIXTURE_RELATIVE,
  fixturePath,
  fixtureRoot,
  listFilesRecursive,
} from "./helpers.ts";

describe("p3 Mode B — vendored seed fixtures", () => {
  test("tests/fixtures/spec-conformance/ exists in-repo (not .samples-only)", () => {
    expect(
      existsSync(fixtureRoot),
      `expected vendored fixture root at ${fixtureRoot}`,
    ).toBe(true);
  });

  test("seed layout includes manifest, lockfile, policy, resolution oracles", () => {
    for (const rel of REQUIRED_FIXTURE_RELATIVE) {
      const abs = fixturePath(rel);
      expect(existsSync(abs), `missing seed fixture ${rel} → ${abs}`).toBe(true);
    }
  });

  test("fixture tree is non-empty and includes round-trip seeds", () => {
    const files = listFilesRecursive(fixtureRoot);
    expect(files.length).toBeGreaterThanOrEqual(REQUIRED_FIXTURE_RELATIVE.length);
    expect(files.some((f) => f.includes("x-extension-roundtrip"))).toBe(true);
    expect(files.some((f) => f.includes("round-trip-unknown-fields"))).toBe(true);
    expect(files.some((f) => f.includes("semver-dialect"))).toBe(true);
  });
});
