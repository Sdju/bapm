/**
 * p2-lk-018: core OpenAPM CI truthiness + effective-frozen resolution (public API).
 * Specs: install-pipeline — CI environment defaults install to frozen.
 */
import { expect, test, describe } from "vite-plus/test";
import { getIsCiEnvTruthy, getResolveEffectiveFrozen } from "./helpers.ts";

describe("core p2-lk-018 isCiEnvTruthy / resolveEffectiveFrozen", () => {
  test("isCiEnvTruthy follows OpenAPM: present and not '', '0', 'false' (case-insensitive)", () => {
    const isCi = getIsCiEnvTruthy();

    expect(isCi({ CI: "true" })).toBe(true);
    expect(isCi({ CI: "1" })).toBe(true);
    expect(isCi({ CI: "yes" })).toBe(true);
    expect(isCi({ CI: "TRUE" })).toBe(true);

    expect(isCi({})).toBe(false);
    expect(isCi({ CI: undefined })).toBe(false);
    expect(isCi({ CI: "" })).toBe(false);
    expect(isCi({ CI: "0" })).toBe(false);
    expect(isCi({ CI: "false" })).toBe(false);
    expect(isCi({ CI: "FALSE" })).toBe(false);
    expect(isCi({ CI: "False" })).toBe(false);

    // Vendor-only vars must NOT imply CI — only the CI variable counts.
    expect(isCi({ GITHUB_ACTIONS: "true", GITLAB_CI: "true" })).toBe(false);
  });

  test("resolveEffectiveFrozen precedence: conflict / --no-frozen / --frozen / CI / default", () => {
    const resolve = getResolveEffectiveFrozen();

    expect(() =>
      resolve({ frozen: true, noFrozen: true, env: { CI: "true" } }),
    ).toThrow(/conflict|mutually|both|frozen/i);

    expect(resolve({ noFrozen: true, env: { CI: "true" } })).toBe(false);
    expect(resolve({ frozen: true, env: { CI: "false" } })).toBe(true);
    expect(resolve({ env: { CI: "true" } })).toBe(true);
    expect(resolve({ env: { CI: "1" } })).toBe(true);
    expect(resolve({ env: {} })).toBe(false);
    expect(resolve({ env: { CI: "false" } })).toBe(false);
    expect(resolve({ env: { CI: "0" } })).toBe(false);
    expect(resolve({ env: { CI: "" } })).toBe(false);
  });
});
