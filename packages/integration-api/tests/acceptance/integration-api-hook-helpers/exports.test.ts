/**
 * Public export surface + README helpers table
 * (integration-api-hook-helpers acceptance).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { api, pkgRoot } from "./helpers.ts";

const REQUIRED = [
  "readHookOwnershipSidecar",
  "writeHookOwnershipSidecar",
  "stripOwnedHookCommands",
  "removeOwnedHookArtifacts",
  "copyHookScript",
] as const;

describe("integration-api-hook-helpers exports", () => {
  test("package root exports hook ownership and copy helpers", () => {
    for (const name of REQUIRED) {
      expect(api, `missing export ${name}`).toHaveProperty(name);
      expect(typeof (api as Record<string, unknown>)[name], name).toBe("function");
    }
  });

  test("README helpers table documents the new symbols", () => {
    const readme = readFileSync(join(pkgRoot, "README.md"), "utf8");
    for (const name of REQUIRED) {
      expect(readme, `README missing ${name}`).toContain(name);
    }
    expect(readme).toMatch(/HookOwnershipSidecar/);
  });
});
