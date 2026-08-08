/**
 * Integration package graph and core's test-only host deps
 * (OpenCode soft edge promoted from integration-opencode-runtime acceptance).
 */
import { expect, test } from "vite-plus/test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = resolve(coreRoot, "../..");
const packagesDir = join(repoRoot, "packages");

function listBapmIntegrationPackageNames(): string[] {
  if (!existsSync(packagesDir)) return [];
  const names: string[] = [];
  for (const entry of readdirSync(packagesDir)) {
    const dir = join(packagesDir, entry);
    if (!statSync(dir).isDirectory()) continue;
    const pkgPath = join(dir, "package.json");
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string };
    if (typeof pkg.name === "string" && pkg.name.startsWith("@bapm/integration-")) {
      names.push(pkg.name);
    }
  }
  return names.sort();
}

test("workspace @bapm/integration-* packages stay in that namespace", () => {
  const names = listBapmIntegrationPackageNames();
  expect(names.length).toBeGreaterThanOrEqual(2);
  expect(names).toContain("@bapm/integration-api");
  expect(names.every((n) => n.startsWith("@bapm/integration-"))).toBe(true);
});

test("core uses Cursor and OpenCode integrations only as development dependencies", () => {
  const coreManifest = JSON.parse(readFileSync(join(coreRoot, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  expect(coreManifest.dependencies).not.toHaveProperty("@bapm/integration-cursor");
  expect(coreManifest.dependencies).not.toHaveProperty("@bapm/integration-opencode");
  expect(coreManifest.devDependencies).toMatchObject({
    "@bapm/integration-cursor": "workspace:*",
    "@bapm/integration-opencode": "workspace:*",
  });
});

test("core vite/test config has no path alias for host integrations", () => {
  const viteConfig = readFileSync(join(coreRoot, "vite.config.ts"), "utf8");
  expect(viteConfig).not.toMatch(/["']@bapm\/integration-cursor["']\s*:/);
  expect(viteConfig).not.toMatch(/["']@bapm\/integration-opencode["']\s*:/);
  expect(viteConfig).not.toMatch(/target-cursor\/src/);
});
