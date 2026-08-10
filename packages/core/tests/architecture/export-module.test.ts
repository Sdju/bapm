/**
 * FEOD Export module layout and package entry surface.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, describe } from "vite-plus/test";
import * as core from "@b-apm/core";
import { getExportSbom } from "../export/helpers.ts";

const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const srcRoot = join(coreRoot, "src");

function listTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listTsFiles(full));
    else if (full.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("Export FEOD module", () => {
  test("modules/Export is a directory module with index.ts (not a single-file module)", () => {
    const exportDir = join(srcRoot, "modules", "Export");
    expect(existsSync(exportDir), "missing src/modules/Export").toBe(true);
    expect(statSync(exportDir).isDirectory()).toBe(true);
    expect(existsSync(join(exportDir, "index.ts")), "missing Export/index.ts").toBe(true);
    expect(existsSync(join(srcRoot, "modules", "Export.ts"))).toBe(false);
  });

  test("app publicApi imports Export only via @/modules/Export public entry", () => {
    const publicApi = readFileSync(join(srcRoot, "app", "publicApi.ts"), "utf8");
    expect(publicApi).toMatch(/@\/modules\/Export/);
    expect(publicApi).not.toMatch(/@\/modules\/Export\/(?!index)/);
  });

  test("Export sources do not deep-import Lockfile internals", () => {
    const exportDir = join(srcRoot, "modules", "Export");
    const files = listTsFiles(exportDir);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toMatch(/@\/modules\/Lockfile\/(?!index)/);
      expect(src, file).not.toMatch(/from ["']\.\.\/Lockfile\//);
    }
  });

  test("exportSbom is a named export of @b-apm/core package entry", () => {
    expect(
      "exportSbom" in core || "exportLockSbom" in core || "exportLockfileSbom" in core,
      "missing SBOM export on @b-apm/core",
    ).toBe(true);
    expect(typeof getExportSbom()).toBe("function");
  });
});
