/**
 * Layered deny-wins resolveExecutableTrust (sc-011).
 * Promoted from sc-executable-governance acceptance.
 */
import { describe, expect, test } from "vite-plus/test";
import { getResolveExecutableTrust, grantSurface } from "./helpers.ts";

describe("resolveExecutableTrust deny-wins (sc-011)", () => {
  test("org deny shadows project allow for MCP", () => {
    const resolve = getResolveExecutableTrust();
    const decision = resolve({
      packageName: "mcp-dep",
      executableType: "mcp",
      orgExecutables: { deny_all: false, deny: ["mcp-dep"] },
      projectSurface: grantSurface({ "mcp-dep": { mcp: true } }),
      userSurface: { present: false, allow: {}, deny: {} },
    });
    expect(decision.outcome).toBe("deny");
    expect(decision.allowed).toBe(false);
  });

  test("org deny_all shadows user allow for MCP", () => {
    const resolve = getResolveExecutableTrust();
    const decision = resolve({
      packageName: "mcp-dep",
      executableType: "mcp",
      orgExecutables: { deny_all: true, deny: [] },
      projectSurface: { present: false, allow: {}, deny: {} },
      userSurface: grantSurface({ "mcp-dep": { mcp: true } }),
    });
    expect(decision.outcome).toBe("deny");
    expect(decision.allowed).toBe(false);
  });

  test("user allow applies when not org-denied and project surface present without allow", () => {
    const resolve = getResolveExecutableTrust();
    const decision = resolve({
      packageName: "mcp-dep",
      executableType: "mcp",
      orgExecutables: { deny_all: false, deny: [] },
      projectSurface: grantSurface({}, {}),
      userSurface: grantSurface({ "mcp-dep": { mcp: true } }),
    });
    expect(decision.outcome).toBe("allow");
    expect(decision.allowed).not.toBe(false);
  });

  test("unapproved withholds when grant surface present (fail-closed)", () => {
    const resolve = getResolveExecutableTrust();
    const decision = resolve({
      packageName: "mcp-dep",
      executableType: "mcp",
      orgExecutables: { deny_all: false, deny: [] },
      projectSurface: grantSurface({}, {}),
      userSurface: { present: false, allow: {}, deny: {} },
    });
    expect(decision.outcome).toBe("withhold");
    expect(decision.allowed).toBe(false);
    expect(decision.withhold === true || decision.outcome === "withhold").toBe(true);
  });

  test("hook allow entry is approved by the same ladder", () => {
    const resolve = getResolveExecutableTrust();
    const decision = resolve({
      packageName: "hook-dep",
      executableType: "hook",
      orgExecutables: { deny_all: false, deny: [] },
      projectSurface: grantSurface({ "hook-dep": { hook: true } }),
      userSurface: { present: false, allow: {}, deny: {} },
    });
    expect(decision.executableType).toBe("hook");
    expect(decision.outcome).toBe("allow");
    expect(decision.allowed).toBe(true);
  });

  test("hook entry for another type does not approve hooks", () => {
    const resolve = getResolveExecutableTrust();
    const decision = resolve({
      packageName: "hook-dep",
      executableType: "hook",
      orgExecutables: { deny_all: false, deny: [] },
      projectSurface: grantSurface({ "hook-dep": { mcp: true } }),
      userSurface: { present: false, allow: {}, deny: {} },
    });
    expect(decision.outcome).toBe("withhold");
    expect(decision.allowed).toBe(false);
  });

  test("hook deny entry withholds; org deny applies to hooks", () => {
    const resolve = getResolveExecutableTrust();
    const projectDeny = resolve({
      packageName: "hook-dep",
      executableType: "hook",
      orgExecutables: { deny_all: false, deny: [] },
      projectSurface: grantSurface({}, { "hook-dep": { hook: true } }),
      userSurface: { present: false, allow: {}, deny: {} },
    });
    expect(projectDeny.outcome).toBe("deny");
    expect(projectDeny.allowed).toBe(false);

    const orgDeny = resolve({
      packageName: "hook-dep",
      executableType: "hook",
      orgExecutables: { deny_all: false, deny: ["hook-dep"] },
      projectSurface: { present: false, allow: {}, deny: {} },
      userSurface: { present: false, allow: {}, deny: {} },
    });
    expect(orgDeny.outcome).toBe("deny");
    expect(orgDeny.allowed).toBe(false);
  });

  test("hooks skip when no surface and no org deny (legacy soft)", () => {
    const resolve = getResolveExecutableTrust();
    const decision = resolve({
      packageName: "hook-dep",
      executableType: "hook",
      orgExecutables: { deny_all: false, deny: [] },
      projectSurface: { present: false, allow: {}, deny: {} },
      userSurface: { present: false, allow: {}, deny: {} },
    });
    expect(decision.outcome).toBe("skip");
    expect(decision.allowed).toBe(true);
  });
});
