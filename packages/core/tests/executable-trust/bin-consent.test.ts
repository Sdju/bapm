/**
 * Unit matrix for resolveBinDeployConsent (install-trust-bin).
 */
import { describe, expect, test } from "vite-plus/test";
import {
  resolveBinDeployConsent,
  type ResolveBinDeployConsentOptions,
} from "../../src/modules/ExecutableTrust/binConsent.ts";

function decide(partial: ResolveBinDeployConsentOptions) {
  return resolveBinDeployConsent(partial);
}

describe("resolveBinDeployConsent", () => {
  test("interactive default deploys with warn when ladder skip", () => {
    const d = decide({
      packageName: "acme/bin-plugin",
      trustBin: "default",
      isInteractive: true,
      projectSurface: { present: false, allow: {}, deny: {} },
    });
    expect(d.deploy).toBe(true);
    expect(d.warn).toBe(true);
    expect(d.ladderOutcome).toBe("skip");
  });

  test("CI / non-interactive default skips without grant", () => {
    const d = decide({
      packageName: "acme/bin-plugin",
      trustBin: "default",
      isInteractive: false,
      env: { CI: "true" },
      projectSurface: { present: false, allow: {}, deny: {} },
    });
    expect(d.deploy).toBe(false);
    expect(d.withhold).toBe(true);
  });

  test("frozen non-interactive default skips without grant", () => {
    const d = decide({
      packageName: "acme/bin-plugin",
      trustBin: "default",
      frozen: true,
      projectSurface: { present: false, allow: {}, deny: {} },
    });
    expect(d.deploy).toBe(false);
  });

  test("--trust-bin / allow deploys when ladder permits", () => {
    const d = decide({
      packageName: "acme/bin-plugin",
      trustBin: "allow",
      isInteractive: false,
      env: { CI: "true" },
      projectSurface: { present: false, allow: {}, deny: {} },
    });
    expect(d.deploy).toBe(true);
    expect(d.warn).toBe(false);
  });

  test("--no-trust-bin / deny skips even with project allow", () => {
    const d = decide({
      packageName: "acme/bin-plugin",
      trustBin: "deny",
      isInteractive: true,
      projectSurface: {
        present: true,
        allow: { "acme/bin-plugin": { bin: true } },
        deny: {},
      },
    });
    expect(d.deploy).toBe(false);
    expect(d.withhold).toBe(true);
  });

  test("org deny beats --trust-bin", () => {
    const d = decide({
      packageName: "acme/bin-plugin",
      trustBin: "allow",
      isInteractive: true,
      orgExecutables: { deny: ["acme/bin-plugin"] },
      projectSurface: { present: false, allow: {}, deny: {} },
    });
    expect(d.deploy).toBe(false);
    expect(d.ladderOutcome).toBe("deny");
  });

  test("project bin allow satisfies non-interactive without flag", () => {
    const d = decide({
      packageName: "acme/bin-plugin",
      trustBin: "default",
      isInteractive: false,
      env: { CI: "true" },
      projectSurface: {
        present: true,
        allow: { "acme/bin-plugin": { bin: true } },
        deny: {},
      },
    });
    expect(d.deploy).toBe(true);
    expect(d.ladderOutcome).toBe("allow");
  });

  test("project bin deny withholds even with trustBin allow", () => {
    const d = decide({
      packageName: "acme/bin-plugin",
      trustBin: "allow",
      isInteractive: true,
      projectSurface: {
        present: true,
        allow: {},
        deny: { "acme/bin-plugin": { bin: true } },
      },
    });
    expect(d.deploy).toBe(false);
    expect(d.ladderOutcome).toBe("deny");
  });
});
