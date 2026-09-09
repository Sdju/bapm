/**
 * Unit: classify retains skillSubset / targetSubset for id: and git:.
 */
import { describe, expect, test } from "vite-plus/test";
import { classifyDependencyRef } from "@b-apm/core";

describe("classify subset carry (unit)", () => {
  test("registry id keeps subsets without changing kind", () => {
    const c = classifyDependencyRef({
      id: "acme/toolkit",
      version: "1.0.0",
      skills: ["alpha"],
      targets: ["cursor"],
    });
    expect(c.kind).toBe("registry");
    expect(c.skillSubset).toEqual(["alpha"]);
    expect(c.targetSubset).toEqual(["cursor"]);
  });

  test("git object-form keeps skillSubset", () => {
    const c = classifyDependencyRef({
      git: "https://github.com/acme/toolkit.git",
      skills: ["alpha"],
    });
    expect(c.kind).toMatch(/^git-/);
    expect(c.skillSubset).toEqual(["alpha"]);
  });
});
