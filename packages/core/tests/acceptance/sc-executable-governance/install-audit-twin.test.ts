/**
 * G5 — install gate ≡ audit/trust classifier via shared resolver (sc-011).
 */
import { describe, expect, test } from "vite-plus/test";
import {
  getClassifyExecutableTrust,
  getResolveExecutableTrust,
  grantSurface,
} from "./helpers.ts";

const SHARED_INPUTS = {
  packageName: "mcp-dep",
  executableType: "mcp" as const,
  orgExecutables: { deny_all: false, deny: ["mcp-dep"] },
  projectSurface: grantSurface({ "mcp-dep": { mcp: true } }),
  userSurface: grantSurface({ "mcp-dep": { mcp: true } }),
};

describe("sc-executable-governance install≡audit twin (G5)", () => {
  test("resolve and classify agree on org deny over project+user allow", () => {
    const resolve = getResolveExecutableTrust();
    const classify = getClassifyExecutableTrust();

    const installSide = resolve({ ...SHARED_INPUTS });
    const auditSide = classify({ ...SHARED_INPUTS });

    expect(installSide.outcome).toBe("deny");
    expect(auditSide.outcome).toBe(installSide.outcome);
    expect(auditSide.allowed).toBe(installSide.allowed);
  });

  test("twin outcomes match for withhold fixture", () => {
    const resolve = getResolveExecutableTrust();
    const classify = getClassifyExecutableTrust();
    const inputs = {
      packageName: "mcp-dep",
      executableType: "mcp",
      orgExecutables: { deny_all: false, deny: [] },
      projectSurface: grantSurface({}, {}),
      userSurface: { present: false, allow: {}, deny: {} },
    };
    const a = resolve(inputs);
    const b = classify(inputs);
    expect(a.outcome).toBe("withhold");
    expect(b.outcome).toBe(a.outcome);
  });
});
