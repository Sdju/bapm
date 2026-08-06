/**
 * G1 — user-local executables store under injectable config root (sc-010).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync } from "node:fs";
import {
  createTempDir,
  getLoadUserExecutableGrants,
  getSaveUserExecutableGrants,
  readJson,
  userConfigJsonPath,
  type TempDir,
} from "./helpers.ts";

describe("sc-executable-governance user store (G1)", () => {
  let tmp: TempDir | undefined;

  afterEach(() => {
    tmp?.cleanup();
    tmp = undefined;
  });

  test("save + reload MCP allow under injectable configRoot/config.json", () => {
    tmp = createTempDir();
    const configRoot = tmp.cwd;
    const save = getSaveUserExecutableGrants();
    const load = getLoadUserExecutableGrants();

    save({
      configRoot,
      configDir: configRoot,
      packageName: "mcp-dep",
      grant: "allow",
      executableType: "mcp",
      allow: { "mcp-dep": { mcp: true } },
      executables: { allow: { "mcp-dep": { mcp: true } }, deny: {} },
    });

    const path = userConfigJsonPath(configRoot);
    expect(existsSync(path), `expected ${path}`).toBe(true);

    const onDisk = readJson(path) as {
      executables?: { allow?: Record<string, unknown>; deny?: Record<string, unknown> };
    };
    expect(onDisk.executables?.allow).toBeTruthy();
    expect(onDisk.executables?.allow?.["mcp-dep"]).toBeTruthy();

    const loaded = load({ configRoot, configDir: configRoot });
    const allow =
      loaded.executables?.allow ??
      loaded.allow ??
      (loaded as { grants?: { allow?: Record<string, unknown> } }).grants?.allow;
    expect(allow?.["mcp-dep"]).toBeTruthy();
  });

  test("isolated config root does not require real ~/.bapm", () => {
    tmp = createTempDir();
    const configRoot = tmp.cwd;
    const save = getSaveUserExecutableGrants();
    const load = getLoadUserExecutableGrants();

    save({
      configRoot,
      configDir: configRoot,
      allow: { "iso-pkg": { mcp: true } },
      executables: { allow: { "iso-pkg": { mcp: true } }, deny: {} },
    });

    const loaded = load({ configRoot, configDir: configRoot });
    const allow = loaded.executables?.allow ?? loaded.allow;
    expect(allow?.["iso-pkg"]).toBeTruthy();
    expect(userConfigJsonPath(configRoot)).toMatch(/config\.json$/);
  });
});
