/**
 * dependencies.require from lockfile presence + distinct withheld (sc-012).
 * Promoted from sc-executable-governance acceptance.
 */
import { describe, expect, test } from "vite-plus/test";
import { diagnosticsOf, getEvaluateRequiredPackagePresence } from "./helpers.ts";

describe("require lock presence + withheld (sc-012)", () => {
  test("present in lock + MCP withheld → presence OK, not POLICY_REQUIRE", () => {
    const evaluate = getEvaluateRequiredPackagePresence();
    const result = evaluate({
      require: ["org/base"],
      lockPackageIds: ["org/base"],
      trustByPackage: {
        "org/base": { outcome: "withhold", allowed: false, withhold: true },
      },
    });

    const diags = diagnosticsOf(result);
    const codes = diags.map((d) => String(d.code ?? "")).join("\n");
    const blob = `${JSON.stringify(result)}\n${codes}`;

    const presenceOk =
      result.ok === true ||
      result.satisfied === true ||
      (Array.isArray(result.violations)
        ? !result.violations.some((v) => String(v.code) === "POLICY_REQUIRE")
        : !/POLICY_REQUIRE/.test(blob) || /EXEC_TRUST_WITHHELD|WITHHELD/.test(blob));

    expect(presenceOk, `presence must be satisfied despite withhold:\n${blob}`).toBe(true);
    expect(blob).not.toMatch(/missing.?package|not.?in.?lock/i);

    const withheld = diags.some((d) =>
      /EXEC_TRUST_WITHHELD|WITHHELD|EXECUTABLE.?WITHHELD/i.test(String(d.code ?? d.message ?? "")),
    );
    expect(
      withheld || /EXEC_TRUST_WITHHELD|WITHHELD/.test(blob),
      `expected distinct withheld diagnostic ≠ POLICY_REQUIRE:\n${blob}`,
    ).toBe(true);
    expect(codes).not.toMatch(/^POLICY_REQUIRE$/m);
    expect(diags.every((d) => String(d.code) !== "POLICY_REQUIRE")).toBe(true);
  });

  test("missing from lock fails with POLICY_REQUIRE / missing-package, not withheld-only", () => {
    const evaluate = getEvaluateRequiredPackagePresence();
    const result = evaluate({
      require: ["org/base"],
      lockPackageIds: ["org/other"],
      trustByPackage: {
        "org/base": { outcome: "withhold", allowed: false, withhold: true },
      },
    });

    const diags = diagnosticsOf(result);
    const blob = JSON.stringify(result);
    const missing =
      result.ok === false ||
      result.satisfied === false ||
      diags.some((d) => /POLICY_REQUIRE|missing/i.test(String(d.code ?? d.message ?? ""))) ||
      /POLICY_REQUIRE|missing/.test(blob);

    expect(missing, `missing-from-lock must fail presence:\n${blob}`).toBe(true);
    expect(blob).toMatch(/POLICY_REQUIRE|missing|not.?present|required/i);
  });
});
