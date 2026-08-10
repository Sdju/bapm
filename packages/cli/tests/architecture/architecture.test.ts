/**
 * Acceptance: cli-feod-architecture (migrate-cli-to-feod)
 * Asserts locked FEOD layout, alias, modules public API, and core boundary.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";

const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const srcRoot = join(cliRoot, "src");

function readText(relativeFromCli: string): string {
  return readFileSync(join(cliRoot, relativeFromCli), "utf8");
}

function listFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

test("FEOD layer roots exist under src", () => {
  for (const layer of ["app", "commands", "modules", "common"] as const) {
    expect(existsSync(join(srcRoot, layer)), `missing src/${layer}`).toBe(true);
  }
});

test("tsconfig maps @/* to ./src/*", () => {
  const tsconfig = JSON.parse(readText("tsconfig.json")) as {
    compilerOptions?: { paths?: Record<string, string[]> };
  };
  expect(tsconfig.compilerOptions?.paths?.["@/*"]).toEqual(["./src/*"]);
});

test("Help, Version, and Install are directory modules with index.ts", () => {
  for (const name of ["Help", "Version", "Install"] as const) {
    const modDir = join(srcRoot, "modules", name);
    expect(statSync(modDir).isDirectory(), `modules/${name} must be a directory`).toBe(true);
    expect(existsSync(join(modDir, "index.ts")), `modules/${name}/index.ts`).toBe(true);
  }
});

test("no single-file modules under src/modules", () => {
  const modulesDir = join(srcRoot, "modules");
  expect(existsSync(modulesDir)).toBe(true);
  const topLevelTs = readdirSync(modulesDir).filter((name) => name.endsWith(".ts"));
  expect(topLevelTs).toEqual([]);
});

test("common has no barrel index.ts", () => {
  expect(existsSync(join(srcRoot, "common"))).toBe(true);
  expect(existsSync(join(srcRoot, "common", "index.ts"))).toBe(false);
});

test("thin command handlers exist for help, version, install", () => {
  for (const name of ["help", "version", "install"] as const) {
    expect(existsSync(join(srcRoot, "commands", `${name}.ts`))).toBe(true);
  }
});

test("app exposes registry, runCli, integrations, and init wiring", () => {
  expect(existsSync(join(srcRoot, "app", "registry.ts"))).toBe(true);
  expect(existsSync(join(srcRoot, "app", "run.ts"))).toBe(true);
  expect(existsSync(join(srcRoot, "app", "integrations"))).toBe(true);
  expect(existsSync(join(srcRoot, "app", "init"))).toBe(true);
});

test("flat src/run.ts is removed after FEOD migration", () => {
  expect(existsSync(join(srcRoot, "run.ts"))).toBe(false);
});

test("package root and binary entries stay thin façades into app runCli", () => {
  const indexSrc = readText("src/index.ts");
  const cliSrc = readText("src/cli.ts");
  expect(indexSrc).toMatch(/runCli/);
  expect(indexSrc).toMatch(/app\/run/);
  expect(cliSrc).toMatch(/runCli/);
  expect(cliSrc).toMatch(/process\.argv/);
});

test("commands must not import @b-apm/core directly", () => {
  const commandsDir = join(srcRoot, "commands");
  expect(existsSync(commandsDir)).toBe(true);
  const offenders = listFilesRecursive(commandsDir)
    .filter((file) => file.endsWith(".ts"))
    .filter((file) => /from\s+["']@b-apm\/core["']/.test(readFileSync(file, "utf8")));
  expect(offenders).toEqual([]);
});

test("Install soft IoC factory is importable via module public API", async () => {
  const mod = await import("@/modules/Install");
  expect(typeof mod.createInstall).toBe("function");
});

test("Help and Version public APIs are importable via @/modules", async () => {
  const help = await import("@/modules/Help");
  const version = await import("@/modules/Version");
  expect(help).toBeTruthy();
  expect(version).toBeTruthy();
  expect(Object.keys(help).length + Object.keys(version).length).toBeGreaterThan(0);
});

test("pack entries remain src/index.ts and src/cli.ts", () => {
  const viteConfig = readText("vite.config.ts");
  expect(viteConfig).toMatch(/index:\s*["']src\/index\.ts["']/);
  expect(viteConfig).toMatch(/cli:\s*["']src\/cli\.ts["']/);
});

test("package.json bin exposes bapm → dist/cli.mjs with node shebang", () => {
  const pkg = JSON.parse(readText("package.json")) as {
    bin?: string | Record<string, string>;
  };
  const bin = typeof pkg.bin === "string" ? { bapm: pkg.bin } : (pkg.bin ?? {});
  expect(bin.bapm).toMatch(/^\.?\/?dist\/cli\.mjs$/);
  expect(bin).not.toHaveProperty("cli");
  expect(readText("src/cli.ts").startsWith("#!/usr/bin/env node")).toBe(true);

  const viteConfig = readText("vite.config.ts");
  expect(viteConfig).toMatch(/bapm:\s*["']\.\/src\/cli\.ts["']/);
});
