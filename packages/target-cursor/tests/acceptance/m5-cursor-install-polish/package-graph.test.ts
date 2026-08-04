/**
 * M5 HARD: workspace must ship only bapm-target-api + bapm-target-cursor
 * among bapm-target-* packages (no second host).
 */
import { expect, test } from "vite-plus/test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const repoRoot = resolve(pkgRoot, "../..");
const packagesDir = join(repoRoot, "packages");

function listBapmTargetPackageNames(): string[] {
  if (!existsSync(packagesDir)) return [];
  const names: string[] = [];
  for (const entry of readdirSync(packagesDir)) {
    const dir = join(packagesDir, entry);
    if (!statSync(dir).isDirectory()) continue;
    const pkgPath = join(dir, "package.json");
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string };
    if (typeof pkg.name === "string" && pkg.name.startsWith("bapm-target-")) {
      names.push(pkg.name);
    }
  }
  return names.sort();
}

test("HARD: only bapm-target-api and bapm-target-cursor among bapm-target-*", () => {
  const names = listBapmTargetPackageNames();
  expect(names).toEqual(["bapm-target-api", "bapm-target-cursor"]);
  expect(names).not.toContain("bapm-target-copilot");
  expect(names).not.toContain("bapm-target-claude");
});
