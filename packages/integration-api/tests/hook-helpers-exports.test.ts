/**
 * Public export surface + README helpers table
 * (promoted from integration-api-hook-helpers acceptance).
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";
import * as api from "../src/index.ts";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED = [
  "readHookOwnershipSidecar",
  "writeHookOwnershipSidecar",
  "stripOwnedHookCommands",
  "removeOwnedHookArtifacts",
  "copyHookScript",
] as const;

describe("integration-api hook helpers exports", () => {
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
