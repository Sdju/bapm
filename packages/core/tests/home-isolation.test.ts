/**
 * Regression: the suite must never depend on the developer's real `~/.bapm`.
 * See report/state-24-09-2026/tests-home-isolation.md.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  PKG_ID,
  consumerManifest,
  createTempProject,
  deployedBinExists,
  gitDepYaml,
  hasBinWithholdDiagnostic,
  installBinPlugin,
  writeManifestYaml,
  type TempProject,
} from "./install/trust-bin-helpers.ts";
import { loadUserExecutableGrants, resolveUserConfigRoot } from "@b-apm/core";

function writeUserGrant(home: string, packageName: string): string {
  const configDir = join(home, ".bapm");
  mkdirSync(configDir, { recursive: true });
  const path = join(configDir, "config.json");
  writeFileSync(
    path,
    JSON.stringify({ executables: { allow: { [packageName]: { bin: true } }, deny: {} } }),
    "utf8",
  );
  return path;
}

async function withHome<T>(home: string, fn: () => Promise<T>): Promise<T> {
  const prev = process.env.HOME;
  process.env.HOME = home;
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.HOME;
    else process.env.HOME = prev;
  }
}

describe("test HOME isolation", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("setup points HOME and the user store at a temporary directory", () => {
    const home = process.env.HOME;
    expect(home).toBeTruthy();
    expect(home).toContain("bapm-test-home-");
    expect(homedir()).toBe(home);
    expect(resolveUserConfigRoot()).toBe(join(home!, ".bapm"));

    const originalHome = process.env.BAPM_TEST_ORIGINAL_HOME;
    if (originalHome) {
      expect(home).not.toBe(originalHome);
    }
  });

  test("a grant written to this test HOME does not affect a fresh HOME install", async () => {
    const isolatedHome = process.env.HOME!;
    writeUserGrant(isolatedHome, PKG_ID);

    // Sanity: the user store follows the isolated HOME.
    expect(Object.keys(loadUserExecutableGrants().allow)).toContain(PKG_ID);

    // A fresh test context resolves a different HOME; the old grant must not leak.
    const freshHome = mkdtempSync(join(tmpdir(), "bapm-test-home-fresh-"));
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeManifestYaml(
      project.cwd,
      consumerManifest({ name: "home-isolation", target: "cursor", depYaml: gitDepYaml() }),
    );

    try {
      const { result } = await withHome(freshHome, () =>
        installBinPlugin(project!.cwd, {
          trustBin: "default",
          isInteractive: false,
          env: { CI: "true" },
        }),
      );

      expect(result).toMatchObject({ ok: true });
      expect(existsSync(join(freshHome, ".bapm", "config.json"))).toBe(false);
      expect(deployedBinExists(project.cwd)).toBe(false);
      expect(hasBinWithholdDiagnostic(result)).toBe(true);
    } finally {
      rmSync(freshHome, { recursive: true, force: true });
    }
  });
});
