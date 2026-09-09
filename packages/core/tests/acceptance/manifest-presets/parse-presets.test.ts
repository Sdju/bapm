/**
 * Acceptance (RED): top-level `presets` field + nested active.
 * OpenSpec change: manifest-presets
 * Specs: manifest-presets, manifest-yaml-validate
 */
import { describe, expect, test } from "vite-plus/test";
import {
  expectParseReject,
  getResolveActive,
  parseOk,
  presetNamesOf,
  resolvedIdsOf,
} from "./helpers.ts";

describe("manifest-presets parse — presets field", () => {
  test("named presets with dependencies accepted and retained", () => {
    const doc = parseOk({
      presets: [
        {
          name: "analyst",
          dependencies: { apm: [{ local: "./pkgs/analyst" }] },
        },
        {
          name: "developer",
          dependencies: { apm: [{ local: "./pkgs/dev" }] },
        },
      ],
      active: { preset: "developer" },
    });

    expect(presetNamesOf(doc)).toEqual(["analyst", "developer"]);
    const presets = doc.presets as Array<Record<string, unknown>>;
    expect(presets[0]?.dependencies).toBeTruthy();
    expect(presets[1]?.dependencies).toBeTruthy();

    const resolved = resolvedIdsOf(getResolveActive()(doc));
    expect(resolved.presetIds).toContain("developer");
    expect(resolved.presetIds).not.toContain("analyst");
  });

  test("absence of presets remains valid", () => {
    const doc = parseOk({ active: { target: "cursor" } });
    expect(doc.presets).toBeUndefined();
    expect(resolvedIdsOf(getResolveActive()(doc)).targetIds).toEqual(["cursor"]);
  });

  test("duplicate preset name rejected fail-closed", () => {
    const { message } = expectParseReject({
      presets: [
        { name: "developer", dependencies: { apm: [] } },
        { name: "developer", dependencies: { apm: [] } },
      ],
    });
    expect(message).toMatch(/developer/);
    expect(message).toMatch(/duplicate|unique|already|presets/i);
  });

  test("empty presets array rejected", () => {
    const { message } = expectParseReject({ presets: [] });
    expect(message).toMatch(/presets/i);
    expect(message).toMatch(/empty|non-empty/i);
  });

  test("preset missing name rejected", () => {
    const { message } = expectParseReject({
      presets: [{ dependencies: { apm: [] } }],
    });
    expect(message).toMatch(/preset|name/i);
  });

  test("preset nested structured active accepted and expanded", () => {
    const doc = parseOk({
      presets: [
        {
          name: "team",
          active: { target: "cursor" },
          dependencies: { apm: [] },
        },
      ],
      active: { preset: "team" },
    });
    const presets = doc.presets as Array<Record<string, unknown>>;
    expect(presets[0]?.name).toBe("team");
    expect(presets[0]?.active).toBeTruthy();

    const resolved = resolvedIdsOf(getResolveActive()(doc));
    expect(resolved.presetIds).toContain("team");
    expect(resolved.targetIds).toContain("cursor");
  });

  test("preset nested legacy bare active rejected", () => {
    const { message, path } = expectParseReject({
      presets: [
        {
          name: "team",
          active: ["cursor"],
        },
      ],
    });
    expect(message).toMatch(/active|legacy|bare|structured|preset/i);
    expect(path === undefined || /presets|active/.test(path)).toBe(true);
  });
});
