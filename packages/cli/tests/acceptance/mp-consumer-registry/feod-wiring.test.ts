/**
 * Acceptance: cli-feod Marketplace wiring presence.
 * Change: mp-consumer-registry (RED until apply).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";

const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const srcRoot = join(cliRoot, "src");

function readText(rel: string): string {
  return readFileSync(join(srcRoot, rel), "utf8");
}

describe("mp-consumer-registry CLI FEOD wiring", () => {
  test("CLI Marketplace directory module + thin command + init exist", () => {
    const modulesDir = join(srcRoot, "modules");
    expect(readdirSync(modulesDir).filter((n) => n === "Marketplace.ts")).toEqual([]);
    const modDir = join(modulesDir, "Marketplace");
    expect(existsSync(modDir), "missing modules/Marketplace").toBe(true);
    expect(statSync(modDir).isDirectory()).toBe(true);
    expect(existsSync(join(modDir, "index.ts"))).toBe(true);
    expect(existsSync(join(srcRoot, "commands", "marketplace.ts"))).toBe(true);
    expect(existsSync(join(srcRoot, "app", "init", "marketplace.ts"))).toBe(true);
  });

  test("registry registers marketplace command constant", () => {
    const registry = readText("app/registry.ts");
    expect(registry).toMatch(/marketplace/i);
    const constants = readText("common/constants/commands.ts");
    expect(constants).toMatch(/MARKETPLACE|marketplace/);
  });
});
