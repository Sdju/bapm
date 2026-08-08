/**
 * Acceptance (RED): `active` does not replace target/targets declared preference.
 * OpenSpec change: manifest-active-targets
 */
import { describe, expect, test } from "vite-plus/test";
import { getDeclaredTargetIds, parseOk } from "./helpers.ts";

describe("manifest-active-targets — active vs target/targets roles", () => {
  test("declaredTargetIds come from targets only, not from active", () => {
    const doc = parseOk({
      targets: ["cursor"],
      active: ["cursor", "x-acme-editor"],
    });

    const ids = getDeclaredTargetIds()(doc);
    expect(ids).toEqual(["cursor"]);
    expect(ids).not.toContain("x-acme-editor");
  });

  test("active alone does not invent declared preference ids", () => {
    const doc = parseOk({
      active: ["cursor"],
    });

    const ids = getDeclaredTargetIds()(doc);
    expect(ids).toEqual([]);
  });
});
