/**
 * Target package graph — only api+cursor hosts; no vite cursor alias in core.
 * Core→api-only dep also covered in install-pipeline.test.ts (kept here for host catalog HARD).
 */
import { expect, test } from "vite-plus/test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
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

test("HARD: only bapm-integration-api and bapm-integration-cursor among bapm-target-*", () => {
  expect(listBapmTargetPackageNames()).toEqual(["bapm-integration-api", "bapm-integration-cursor"]);
});

test("core vite/test config has no path alias for bapm-integration-cursor", () => {
  const viteConfig = readFileSync(join(coreRoot, "vite.config.ts"), "utf8");
  expect(viteConfig).not.toMatch(/["']bapm-integration-cursor["']\s*:/);
  expect(viteConfig).not.toMatch(/target-cursor\/src/);
});
