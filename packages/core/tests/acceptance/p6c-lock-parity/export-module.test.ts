/**
 * p6c-lock-parity — core-feod-architecture: Export module + package entry.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test, describe } from "vite-plus/test";
import * as core from "@bapm/core";
import { getExportSbom, srcRoot } from "./helpers.ts";

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

describe("p6c Export FEOD module", () => {
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

  test("exportSbom is a named export of @bapm/core package entry", () => {
    expect(
      "exportSbom" in core || "exportLockSbom" in core || "exportLockfileSbom" in core,
      "missing SBOM export on @bapm/core",
    ).toBe(true);
    expect(typeof getExportSbom()).toBe("function");
  });
});
