/**
 * cli-feod-architecture — authoring stays in existing Marketplace module (no new top-level).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";

const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const srcRoot = join(cliRoot, "src");

function readSrc(rel: string): string {
  return readFileSync(join(srcRoot, rel), "utf8");
}

describe("mp-authoring-yml CLI FEOD Marketplace authoring wiring", () => {
  test("Marketplace remains the only top-level marketplace module", () => {
    const modulesDir = join(srcRoot, "modules");
    expect(readdirSync(modulesDir).filter((n) => n === "Marketplace.ts")).toEqual([]);
    const modDir = join(modulesDir, "Marketplace");
    expect(existsSync(modDir)).toBe(true);
    expect(statSync(modDir).isDirectory()).toBe(true);
    expect(existsSync(join(modDir, "index.ts"))).toBe(true);
    expect(readdirSync(modulesDir).filter((n) => /Authoring/i.test(n))).toEqual([]);
  });

  test("thin commands/marketplace.ts does not import @b-apm/core directly", () => {
    const body = readSrc("commands/marketplace.ts");
    expect(body).not.toMatch(/from\s+["']@b-apm\/core["']/);
    expect(body.length).toBeLessThan(4000);
  });

  test("SUPPORTED authoring verbs appear in Marketplace module (not only consumer set)", () => {
    const run = readSrc("modules/Marketplace/services/runMarketplace.ts");
    expect(run).toMatch(/["']init["']/);
    expect(run).toMatch(/["']check["']/);
    expect(run).toMatch(/["']package["']/);
  });

  test("Marketplace module has no module-local commands/ folder", () => {
    expect(existsSync(join(srcRoot, "modules", "Marketplace", "commands"))).toBe(false);
  });

  test("app/init/marketplace + commands import Marketplace public entry only", () => {
    const cmd = readSrc("commands/marketplace.ts");
    const init = readSrc("app/init/marketplace.ts");
    expect(cmd + "\n" + init).toMatch(/@\/modules\/Marketplace/);
    expect(cmd).not.toMatch(/@\/modules\/Marketplace\//);
    expect(init).not.toMatch(/@\/modules\/Marketplace\//);
  });
});
