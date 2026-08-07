/**
 * CLI unit: lk-018 parseInstallArgs — CI-default, --no-frozen, conflicts.
 */
import { expect, test, describe } from "vite-plus/test";
import { parseInstallArgs } from "../../src/modules/Install/services/runInstall.ts";

describe("parseInstallArgs CI-default frozen (lk-018)", () => {
  test("CI=true without flags → effective frozen", () => {
    const parsed = parseInstallArgs([], { env: { CI: "true" } });
    expect(parsed.error).toBeUndefined();
    expect(parsed.frozen).toBe(true);
  });

  test("--no-frozen under CI → non-frozen", () => {
    const parsed = parseInstallArgs(["--no-frozen"], { env: { CI: "true" } });
    expect(parsed.error).toBeUndefined();
    expect(parsed.frozen).toBe(false);
    expect(parsed.noFrozen).toBe(true);
  });

  test("non-truthy CI → non-frozen by default", () => {
    for (const ci of [undefined, "", "0", "false"] as const) {
      const env = ci === undefined ? ({} as Record<string, string | undefined>) : { CI: ci };
      const parsed = parseInstallArgs([], { env });
      expect(parsed.error).toBeUndefined();
      expect(parsed.frozen).toBe(false);
    }
  });

  test("--frozen + --no-frozen conflict", () => {
    const parsed = parseInstallArgs(["--frozen", "--no-frozen"], { env: {} });
    expect(parsed.error).toMatch(/conflict|mutually|both|--frozen.*--no-frozen/i);
  });

  test("CI-default + --update rejected", () => {
    const parsed = parseInstallArgs(["--update"], { env: { CI: "true" } });
    expect(parsed.error).toMatch(/frozen|update/i);
  });
});
