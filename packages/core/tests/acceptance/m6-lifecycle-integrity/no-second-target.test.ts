/**
 * M6 HARD: no second bapm-target-* (checklist C §27) — regression guard.
 * This case is expected GREEN before apply; domain suites remain RED.
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

test("§27 HARD: workspace bapm-target-* is only api + cursor", () => {
  expect(listBapmTargetPackageNames()).toEqual(["bapm-target-api", "bapm-target-cursor"]);
});
