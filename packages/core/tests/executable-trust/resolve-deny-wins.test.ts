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
});
