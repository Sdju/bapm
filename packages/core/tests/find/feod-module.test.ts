/**
 * core-feod-architecture — Find module layout + no Marketplace.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as core from "@bapm/core";
import { describe, expect, test } from "vite-plus/test";
import {
  getBuildReverseIndex,
  getFindPath,
  getLookupInIndex,
  listFilesRecursive,
  pickExport,
  readSrc,
  srcRoot,
} from "./helpers.ts";

describe("mp-find FEOD Find module", () => {
  test("modules/Find is a directory module with index.ts (not single-file)", () => {
    const modDir = join(srcRoot, "modules", "Find");
    expect(existsSync(modDir), "missing modules/Find").toBe(true);
    expect(statSync(modDir).isDirectory()).toBe(true);
    expect(existsSync(join(modDir, "index.ts")), "modules/Find/index.ts").toBe(true);
    const topLevelTs = readdirSync(join(srcRoot, "modules")).filter((n) => n === "Find.ts");
    expect(topLevelTs, "Find must not be a single-file module").toEqual([]);
  });

  test("app publicApi imports Find only via @/modules/Find public entry", () => {
    const publicApi = readSrc("app/publicApi.ts");
    expect(publicApi).toMatch(/@\/modules\/Find/);
    expect(publicApi).not.toMatch(/@\/modules\/Find\/(?!index)/);
  });

  test("Find public symbols resolve from @bapm/core package entry", () => {
    // Soft-resolve — throws TypeError (RED) until apply exports them.
    expect(typeof getBuildReverseIndex()).toBe("function");
    expect(typeof getLookupInIndex()).toBe("function");
    expect(typeof getFindPath()).toBe("function");
    const c = core as Record<string, unknown>;
    expect(
      "buildReverseIndex" in c || "build_reverse_index" in c || "buildFindReverseIndex" in c,
    ).toBe(true);
  });

  test("Find sources MUST NOT import Marketplace", () => {
    const modDir = join(srcRoot, "modules", "Find");
    expect(existsSync(modDir)).toBe(true);
    const files = listFilesRecursive(modDir).filter((f) => f.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const body = readFileSync(file, "utf8");
      expect(body, file).not.toMatch(/modules\/Marketplace/);
      expect(body, file).not.toMatch(/from\s+["']@\/modules\/Marketplace/);
      expect(body, file).not.toMatch(/createMarketplace|fetchMarketplace|parseMarketplaceJson/);
    }
  });

  test("consumers must not need deep imports into Find internals", () => {
    // Public barrel must re-export orchestration helpers (names flexible).
    pickExport(
      ["findPath", "runFind", "findDeployedPath", "runFindPath"],
      "find orchestration export",
    );
  });
});
