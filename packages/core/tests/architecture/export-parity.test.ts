/**
 * Acceptance: core-feod-architecture — public export parity smoke
 * Key named exports must remain available from @b-apm/core after FEOD migrate.
 * Behavioral M1/M2 suites stay separate.
 */
import { expect, test } from "vite-plus/test";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as core from "@b-apm/core";

const pkgVersion = (
  createRequire(import.meta.url)(
    join(dirname(fileURLToPath(import.meta.url)), "../../package.json"),
  ) as {
    version: string;
  }
).version;

test("key Manifest / Lockfile / package symbols remain named exports of @b-apm/core", () => {
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
  expect(core.getVersion()).toBe(pkgVersion);
  expect(typeof core.parseManifest).toBe("function");
  expect(typeof core.parseLockfile).toBe("function");
  expect(typeof core.loadYamlDocument).toBe("function");
});
