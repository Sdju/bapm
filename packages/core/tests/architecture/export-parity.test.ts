/**
 * Acceptance: core-feod-architecture — public export parity smoke
 * Key named exports must remain available from @bapm/core after FEOD migrate.
 * Behavioral M1/M2 suites stay separate.
 */
import { expect, test } from "vite-plus/test";
import * as core from "@bapm/core";

test("key Manifest / Lockfile / package symbols remain named exports of @bapm/core", () => {
  const required: Array<keyof typeof core> = [
    "APM_MANIFEST_FILE",
    "BAPM_MANIFEST_FILE",
    "discoverManifestPath",
    "loadManifest",
    "parseManifest",
    "parseManifestDocument",
    "loadYamlDocument",
    "ManifestError",
    "APM_LOCK_FILE",
    "BAPM_LOCK_FILE",
    "discoverLockfilePath",
    "loadLockfile",
    "loadLockfileOrNull",
    "writeLockfile",
    "parseLockfile",
    "parseLockfileDocument",
    "serializeLockfile",
    "isSemanticallyEquivalent",
    "LockfileError",
    "BAPM_NAME",
    "getVersion",
  ];

  for (const name of required) {
    expect(name in core, `missing export: ${name}`).toBe(true);
  }

  expect(core.BAPM_NAME).toBe("bapm");
  expect(typeof core.getVersion).toBe("function");
  expect(core.getVersion()).toBe("0.0.0");
  expect(typeof core.parseManifest).toBe("function");
  expect(typeof core.parseLockfile).toBe("function");
  expect(typeof core.loadYamlDocument).toBe("function");
});
