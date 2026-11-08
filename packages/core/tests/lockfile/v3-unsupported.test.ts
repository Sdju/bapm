/**
 * P1 parity: lockfile v3 (APM 0.35 replacement evidence) must fail with a
 * specific, actionable diagnostic; v1/v2 stay unchanged.
 */
import { describe, expect, test } from "vite-plus/test";
import { loadLockfile, parseLockfile } from "@b-apm/core";
import { readFixture, fixturePath } from "./helpers.ts";

function catchError(fn: () => unknown): { code?: string; message?: string } {
  try {
    fn();
  } catch (error) {
    return error as { code?: string; message?: string };
  }
  throw new Error("expected throw");
}

describe("lockfile v3 unsupported", () => {
  test("v3 fails with LOCKFILE_V3_UNSUPPORTED and replacement remediation", () => {
    const err = catchError(() => parseLockfile('lockfile_version: "3"\ndependencies: []\n'));
    expect(err.code).toBe("LOCKFILE_V3_UNSUPPORTED");
    expect(err.message).toMatch(/APM 0\.35/);
    expect(err.message).toMatch(/replace/i);
    expect(err.message).toMatch(/bapm lock|regenerate/i);
    expect(err.message).toMatch(/supported versions: "1", "2"/i);
  });

  test("v1 and v2 fixtures still parse", () => {
    expect(loadLockfile({ path: fixturePath("minimal-v1.yml") }).document.lockfile_version).toBe(
      "1",
    );
    expect(
      loadLockfile({ path: fixturePath("v2-with-registry.yml") }).document.lockfile_version,
    ).toBe("2");
  });

  test("other unsupported versions keep the generic diagnostic", () => {
    const err = catchError(() => parseLockfile('lockfile_version: "4"\ndependencies: []\n'));
    expect(err.code).toBe("LOCKFILE_UNSUPPORTED_VERSION");
    expect(err.message).not.toMatch(/APM 0\.35/);
  });

  test("v3 fixture on disk is rejected", () => {
    const err = catchError(() => loadLockfile({ path: fixturePath("invalid-version-3.yml") }));
    expect(err.code).toBe("LOCKFILE_V3_UNSUPPORTED");
    expect(readFixture("invalid-version-3.yml")).toMatch(/lockfile_version:\s*["']?3/);
  });
});
