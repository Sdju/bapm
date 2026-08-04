/**
 * M5 acceptance: materialize may report deployed paths via bapm-target-api only.
 * No adapter catalog / MCP configure surface.
 */
import { expect, test, describe } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as api from "../../../src/index.ts";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("M5 target-api materialize report contract", () => {
  test("public API exposes materialize report types for deployed paths", () => {
    // Types are compile-time; assert package documents/exports the shape consumers need.
    const indexSrc = readFileSync(join(pkgRoot, "src", "index.ts"), "utf8");
    const typesSrc = readFileSync(join(pkgRoot, "src", "types.ts"), "utf8");
    const combined = `${indexSrc}\n${typesSrc}`;

    expect(combined).toMatch(/MaterializeReport|DeployedFile|deployedFiles/);
    expect(combined).toMatch(/deployed/i);

    // Runtime: materialize return type must be part of BapmTarget contract text
    expect(typesSrc).toMatch(/materialize\s*:\s*\(/);
    expect(typesSrc).toMatch(
      /MaterializeReport|deployedFiles|Promise<\s*(void\s*\|\s*)?MaterializeReport|Promise<\s*MaterializeReport/,
    );
  });

  test("api stays host-agnostic — no second-host catalog or MCP configure API", () => {
    const typesSrc = readFileSync(join(pkgRoot, "src", "types.ts"), "utf8");
    const indexSrc = readFileSync(join(pkgRoot, "src", "index.ts"), "utf8");
    const combined = `${typesSrc}\n${indexSrc}`;

    expect(combined).not.toMatch(/copilot|claude|vscode/i);
    expect(combined).not.toMatch(/mcp\.json|configureMcp|McpClient/i);
    expect(combined).not.toMatch(/adapterCatalog|AdapterCatalog|hostCatalog/i);

    // Registry remains generic
    expect(typeof api.createTargetRegistry).toBe("function");
    const registry = api.createTargetRegistry();
    expect(typeof registry.register).toBe("function");
  });
});
