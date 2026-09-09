/**
 * resolveActive expansion — negation, nested, cycles
 * (promoted from manifest-presets acceptance).
 */
import { describe, expect, test } from "vite-plus/test";
import {
  expectThrowsMatching,
  getResolveActive,
  parseOk,
  resolvedIdsOf,
} from "./presets-helpers.ts";

describe("manifest resolveActive — include / negate", () => {
  test("include then negate drops preset from included set", () => {
    const doc = parseOk({
      presets: [{ name: "developer", dependencies: { apm: [] } }],
      active: [{ preset: "developer" }, { preset: "!developer" }],
    });

    const resolved = resolvedIdsOf(getResolveActive()(doc));
    expect(resolved.presetIds).not.toContain("developer");
  });

  test("unknown included preset fails closed naming the id", () => {
    const doc = parseOk({
      presets: [{ name: "developer", dependencies: { apm: [] } }],
      active: { preset: "missing-role" },
    });

    expectThrowsMatching(() => getResolveActive()(doc), /missing-role/);
  });

  test("target selections appear in targetIds only", () => {
    const doc = parseOk({
      presets: [{ name: "developer", dependencies: { apm: [] } }],
      active: { preset: "developer", target: "cursor" },
    });

    const resolved = resolvedIdsOf(getResolveActive()(doc));
    expect(resolved.presetIds).toContain("developer");
    expect(resolved.targetIds).toEqual(["cursor"]);
    expect(resolved.targetIds).not.toContain("developer");
  });
});

describe("manifest resolveActive — nested active + cycles", () => {
  test("acyclic nested preset expands both team and developer", () => {
    const doc = parseOk({
      presets: [
        {
          name: "developer",
          dependencies: { apm: [] },
        },
        {
          name: "team",
          active: { preset: "developer" },
          dependencies: { apm: [] },
        },
      ],
      active: { preset: "team" },
    });

    const resolved = resolvedIdsOf(getResolveActive()(doc));
    expect(resolved.presetIds).toEqual(expect.arrayContaining(["team", "developer"]));
  });

  test("recursive preset→active chain fails closed citing cycle", () => {
    const doc = parseOk({
      presets: [
        {
          name: "a",
          active: { preset: "b" },
          dependencies: { apm: [] },
        },
        {
          name: "b",
          active: { preset: "a" },
          dependencies: { apm: [] },
        },
      ],
      active: { preset: "a" },
    });

    expectThrowsMatching(() => getResolveActive()(doc), /cycle|circular|recursive|loop/i);
  });
});
