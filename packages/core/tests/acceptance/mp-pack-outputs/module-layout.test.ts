/**
 * FEOD — Marketplace fractal builder / PackOutputs lives under Marketplace, not top-level.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import {
  core,
  listFilesRecursive,
  marketplaceSrc,
  readSrc,
  srcRoot,
} from "./helpers.ts";

describe("mp-pack-outputs core Marketplace builder layout", () => {
  test("Marketplace module directory exists", () => {
    expect(existsSync(marketplaceSrc)).toBe(true);
    expect(statSync(marketplaceSrc).isDirectory()).toBe(true);
  });

  test("builder / PackOutputs fractal sources exist under Marketplace/modules", () => {
    const modulesDir = join(marketplaceSrc, "modules");
    expect(existsSync(modulesDir)).toBe(true);
    const names = readdirSync(modulesDir);
    const builderish = names.filter((n) =>
      /PackOutputs|Builder|pack.?outputs/i.test(n),
    );
    expect(
      builderish.length,
      `expected PackOutputs/Builder under Marketplace/modules, got: ${names.join(", ")}`,
    ).toBeGreaterThan(0);
  });

  test("no top-level PackOutputs / MarketplaceBuilder module beside Marketplace", () => {
    const modules = join(srcRoot, "modules");
    const names = readdirSync(modules);
    expect(names.filter((n) => /^PackOutputs$/i.test(n))).toEqual([]);
    expect(names.filter((n) => /^MarketplaceBuilder$/i.test(n))).toEqual([]);
  });

  test("publicApi + Marketplace index export builder entrypoints", () => {
    const publicApi = readSrc("app/publicApi.ts");
    const index = readFileSync(join(marketplaceSrc, "index.ts"), "utf8");
    const surface = `${publicApi}\n${index}`;
    expect(surface).toMatch(
      /buildMarketplaceOutputs|emitMarketplacePackOutputs|runMarketplaceBuilder|writeMarketplacePackOutputs|resolveMarketplacePackages/,
    );
  });

  test("@bapm/core exports marketplace pack-outputs builder", () => {
    const c = core as Record<string, unknown>;
    const hasBuilder = [
      "buildMarketplaceOutputs",
      "emitMarketplacePackOutputs",
      "runMarketplaceBuilder",
      "writeMarketplacePackOutputs",
    ].some((n) => typeof c[n] === "function");
    expect(hasBuilder, "missing marketplace pack-outputs builder export").toBe(true);
  });

  test("builder sources mention Claude and Codex mappers", () => {
    const files = listFilesRecursive(marketplaceSrc).filter((f) => f.endsWith(".ts"));
    const builderFiles = files.filter((f) =>
      /PackOutputs|Builder|mapper|output.?profile/i.test(f),
    );
    expect(builderFiles.length).toBeGreaterThan(0);
    const body = builderFiles.map((f) => readFileSync(f, "utf8")).join("\n");
    expect(body).toMatch(/claude/i);
    expect(body).toMatch(/codex/i);
  });
});
