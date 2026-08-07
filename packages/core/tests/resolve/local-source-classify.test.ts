/**
 * Unit: classify + expand bapm `local`; path: regression.
 */
import { describe, expect, test } from "vite-plus/test";
import { classifyDependencyRef, DEFAULT_LOCAL_ROOT, effectiveLocalPath } from "@bapm/core";

describe("Resolver local source classify", () => {
  test("default forms expand to .agents/local", () => {
    expect(effectiveLocalPath(true)).toBe(DEFAULT_LOCAL_ROOT);
    expect(effectiveLocalPath(null)).toBe(DEFAULT_LOCAL_ROOT);
    expect(effectiveLocalPath("")).toBe(DEFAULT_LOCAL_ROOT);
    for (const local of [true, null, ""]) {
      expect(classifyDependencyRef({ local })).toMatchObject({
        kind: "local",
        path: DEFAULT_LOCAL_ROOT,
      });
    }
  });

  test("string shorthand 'local' expands to .agents/local not ./local", () => {
    expect(classifyDependencyRef("local")).toMatchObject({
      kind: "local",
      path: DEFAULT_LOCAL_ROOT,
    });
  });

  test("custom string keeps declared path", () => {
    expect(classifyDependencyRef({ local: "./alt" })).toMatchObject({
      kind: "local",
      path: "./alt",
    });
  });

  test("OpenAPM path: classification unchanged", () => {
    expect(classifyDependencyRef({ path: "./pkgs/a" })).toMatchObject({
      kind: "local",
      path: "./pkgs/a",
    });
    expect(classifyDependencyRef("./pkgs/a")).toMatchObject({
      kind: "local",
      path: "./pkgs/a",
    });
  });
});
