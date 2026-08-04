/**
 * Unit: OpenAPM lk-018 CI truthiness + effective frozen precedence.
 */
import { expect, test, describe } from "vite-plus/test";
import { isCiEnvTruthy, resolveEffectiveFrozen } from "@bapm/core";

describe("isCiEnvTruthy / resolveEffectiveFrozen (lk-018)", () => {
  test("truthy and non-truthy CI values", () => {
    expect(isCiEnvTruthy({ CI: "true" })).toBe(true);
    expect(isCiEnvTruthy({ CI: "1" })).toBe(true);
    expect(isCiEnvTruthy({ CI: "yes" })).toBe(true);
    expect(isCiEnvTruthy({})).toBe(false);
    expect(isCiEnvTruthy({ CI: "" })).toBe(false);
    expect(isCiEnvTruthy({ CI: "0" })).toBe(false);
    expect(isCiEnvTruthy({ CI: "false" })).toBe(false);
    expect(isCiEnvTruthy({ CI: "FALSE" })).toBe(false);
    expect(isCiEnvTruthy({ GITHUB_ACTIONS: "true" })).toBe(false);
  });

  test("resolveEffectiveFrozen precedence", () => {
    expect(() =>
      resolveEffectiveFrozen({ frozen: true, noFrozen: true, env: { CI: "true" } }),
    ).toThrow(/conflict|mutually|both|frozen/i);

    expect(resolveEffectiveFrozen({ noFrozen: true, env: { CI: "true" } })).toBe(false);
    expect(resolveEffectiveFrozen({ frozen: true, env: { CI: "false" } })).toBe(true);
    expect(resolveEffectiveFrozen({ env: { CI: "true" } })).toBe(true);
    expect(resolveEffectiveFrozen({ env: {} })).toBe(false);
    expect(resolveEffectiveFrozen({ env: { CI: "0" } })).toBe(false);
  });
});
