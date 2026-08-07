/**
 * Materialize may report deployed paths via @bapm/integration-api only.
 * No adapter catalog / MCP configure surface.
 */
import { expect, test, describe } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as api from "../src/index.ts";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("target-api materialize report contract", () => {
  test("public API exposes materialize report types for deployed paths", () => {
    // Types are compile-time; assert package documents/exports the shape consumers need.
    const indexSrc = readFileSync(join(pkgRoot, "src", "index.ts"), "utf8");
    const typesSrc = readFileSync(join(pkgRoot, "src", "types.ts"), "utf8");
    const combined = `${indexSrc}\n${typesSrc}`;

    expect(combined).toMatch(/MaterializeReport|DeployedFile|deployedFiles/);
    expect(combined).toMatch(/deployed/i);

    // Runtime: materialize return type must be part of BapmIntegration contract text
    expect(typesSrc).toMatch(/materialize\s*:\s*\(/);
    expect(typesSrc).toMatch(
      /MaterializeReport|deployedFiles|Promise<\s*(void\s*\|\s*)?MaterializeReport|Promise<\s*MaterializeReport/,
    );
  });

  test("api stays host-agnostic while exposing the generic MCP configure contract", () => {
    const typesSrc = readFileSync(join(pkgRoot, "src", "types.ts"), "utf8");
    const indexSrc = readFileSync(join(pkgRoot, "src", "index.ts"), "utf8");
    const combined = `${typesSrc}\n${indexSrc}`;

    expect(combined).not.toMatch(/copilot|claude|vscode/i);
    expect(combined).not.toMatch(/McpClient/i);
    expect(combined).not.toMatch(/adapterCatalog|AdapterCatalog|hostCatalog/i);
    expect(combined).toMatch(/ConfigureMcpFn|configureMcp|ConfigureMcpReport/);

    // Registry and MCP capability remain generic.
    expect(typeof api.createIntegrationRegistry).toBe("function");
    const registry = api.createIntegrationRegistry();
    expect(typeof registry.register).toBe("function");
  });
});
