/**
 * `isPackageMentionedInGrants` distinguishes an explicit allow/deny entry from
 * an unmentioned package (install skips the latter with a warning instead of
 * failing the whole run).
 */
import { describe, expect, test } from "vite-plus/test";
import { getIsPackageMentionedInGrants, grantSurface } from "./helpers.ts";

describe("isPackageMentionedInGrants", () => {
  test("unmentioned in every surface → false", () => {
    const check = getIsPackageMentionedInGrants();
    expect(
      check({
        packageName: "mcp-dep",
        projectSurface: grantSurface({ "acme/other": { mcp: true } }),
        userSurface: { present: false, allow: {}, deny: {} },
        orgExecutables: { deny_all: false, deny: [] },
      }),
    ).toBe(false);
  });

  test("project allow entry with mcp: false still counts as mentioned", () => {
    const check = getIsPackageMentionedInGrants();
    expect(
      check({
        packageName: "mcp-dep",
        projectSurface: grantSurface({ "mcp-dep": { mcp: false } }),
        userSurface: { present: false, allow: {}, deny: {} },
        orgExecutables: { deny_all: false, deny: [] },
      }),
    ).toBe(true);
  });

  test("another executable type only counts as mentioned", () => {
    const check = getIsPackageMentionedInGrants();
    expect(
      check({
        packageName: "mcp-dep",
        projectSurface: grantSurface({ "mcp-dep": { bin: true } }),
        userSurface: { present: false, allow: {}, deny: {} },
        orgExecutables: { deny_all: false, deny: [] },
      }),
    ).toBe(true);
  });

  test("user allow/deny entries count as mentioned", () => {
    const check = getIsPackageMentionedInGrants();
    expect(
      check({
        packageName: "mcp-dep",
        projectSurface: grantSurface({}, {}),
        userSurface: grantSurface({}, { "mcp-dep": { mcp: true } }),
        orgExecutables: { deny_all: false, deny: [] },
      }),
    ).toBe(true);
  });

  test("org deny list and deny_all count as mentioned", () => {
    const check = getIsPackageMentionedInGrants();
    expect(
      check({
        packageName: "mcp-dep",
        projectSurface: grantSurface({}, {}),
        userSurface: { present: false, allow: {}, deny: {} },
        orgExecutables: { deny_all: false, deny: ["mcp-dep"] },
      }),
    ).toBe(true);
    expect(
      check({
        packageName: "anything",
        projectSurface: grantSurface({}, {}),
        userSurface: { present: false, allow: {}, deny: {} },
        orgExecutables: { deny_all: true, deny: [] },
      }),
    ).toBe(true);
  });
});
