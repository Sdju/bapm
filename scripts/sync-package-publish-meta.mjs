#!/usr/bin/env node
/**
 * Sync publish metadata across packages package.json files and copy root LICENSE.
 * Run before first release / after adding a package:
 *   node scripts/sync-package-publish-meta.mjs
 */
import { copyFileSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = join(root, "packages");
const licenseSrc = join(root, "LICENSE");
const repoUrl = "git+https://github.com/Sdju/bapm.git";
const homepage = "https://github.com/Sdju/bapm#readme";
const bugs = "https://github.com/Sdju/bapm/issues";
const engines = { node: ">=22.12.0" };

const dirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

let updated = 0;
for (const name of dirs) {
  const pkgDir = join(packagesDir, name);
  const pkgPath = join(pkgDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  if (pkg.private === true) continue;

  pkg.license = "MIT";
  pkg.engines = engines;
  pkg.repository = {
    type: "git",
    url: repoUrl,
    directory: `packages/${name}`,
  };
  pkg.homepage = homepage;
  pkg.bugs = { url: bugs };
  pkg.publishConfig = { ...pkg.publishConfig, access: "public" };
  pkg.scripts = {
    ...pkg.scripts,
    prepublishOnly: "vp run build",
  };

  // Stable key order: keep name/version/description near top; rewrite whole file sorted lightly.
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  copyFileSync(licenseSrc, join(pkgDir, "LICENSE"));
  updated += 1;
  console.log(`updated ${pkg.name}`);
}

console.log(`done: ${updated} packages`);
