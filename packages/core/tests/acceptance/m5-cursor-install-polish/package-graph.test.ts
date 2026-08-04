/**
 * M5 acceptance: package graph — core↔api only; no vite cursor alias; only api+cursor hosts.
 */
import { expect, test } from "vite-plus/test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const repoRoot = resolve(coreRoot, "../..");
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
  expect(listBapmTargetPackageNames()).toEqual([
    "bapm-target-api",
    "bapm-target-cursor",
  ]);
});

test("core package.json depends on bapm-target-api only among bapm-target-*", () => {
  const pkg = JSON.parse(readFileSync(join(coreRoot, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const targetDeps = Object.keys(deps).filter((n) => n.startsWith("bapm-target-"));
  expect(targetDeps).toEqual(["bapm-target-api"]);
  expect(deps["bapm-target-cursor"]).toBeUndefined();
});

test("core vite/test config has no path alias for bapm-target-cursor", () => {
  const viteConfig = readFileSync(join(coreRoot, "vite.config.ts"), "utf8");
  expect(viteConfig).not.toMatch(/["']bapm-target-cursor["']\s*:/);
  expect(viteConfig).not.toMatch(/target-cursor\/src/);
});
