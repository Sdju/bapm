/**
 * cli-feod-architecture — Approve / Deny directory modules + thin commands.
 * Promoted from sc-executable-governance acceptance.
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

describe("CLI FEOD Approve/Deny wiring", () => {
  test("Approve is a directory module with index.ts public entry", () => {
    const modDir = join(srcRoot, "modules", "Approve");
    expect(existsSync(modDir), "modules/Approve must exist").toBe(true);
    expect(statSync(modDir).isDirectory()).toBe(true);
    expect(existsSync(join(modDir, "index.ts"))).toBe(true);
  });

  test("Deny is a directory module with index.ts public entry", () => {
    const modDir = join(srcRoot, "modules", "Deny");
    expect(existsSync(modDir), "modules/Deny must exist").toBe(true);
    expect(statSync(modDir).isDirectory()).toBe(true);
    expect(existsSync(join(modDir, "index.ts"))).toBe(true);
  });

  test("thin commands/approve.ts and commands/deny.ts do not import @bapm/core directly", () => {
    expect(existsSync(join(srcRoot, "commands", "approve.ts"))).toBe(true);
    expect(existsSync(join(srcRoot, "commands", "deny.ts"))).toBe(true);
    const approve = readSrc("commands/approve.ts");
    const deny = readSrc("commands/deny.ts");
    expect(approve).not.toMatch(/from\s+["']@bapm\/core["']/);
    expect(deny).not.toMatch(/from\s+["']@bapm\/core["']/);
    expect(approve.length).toBeLessThan(4000);
    expect(deny.length).toBeLessThan(4000);
  });

  test("commands import Approve/Deny public entry only (no deep imports)", () => {
    const approve = readSrc("commands/approve.ts");
    const deny = readSrc("commands/deny.ts");
    expect(approve).toMatch(/@\/modules\/Approve/);
    expect(deny).toMatch(/@\/modules\/Deny/);
    expect(approve).not.toMatch(/@\/modules\/Approve\//);
    expect(deny).not.toMatch(/@\/modules\/Deny\//);
  });

  test("no module-local commands/ or private _approve/_deny command modules", () => {
    for (const name of ["Approve", "Deny"]) {
      const modCommands = join(srcRoot, "modules", name, "commands");
      expect(existsSync(modCommands)).toBe(false);
    }
    const commands = readdirSync(join(srcRoot, "commands"));
    expect(commands.filter((n) => n.startsWith("_"))).toEqual([]);
  });
});
