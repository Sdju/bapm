/**
 * Acceptance: core-feod-architecture (migrate-core-to-feod)
 * Asserts library FEOD layout, feod block, @/* alias, module boundaries,
 * no Lockfile→Manifest deep YAML import, thin index→app/publicApi.
 *
 * Does not re-assert M1/M2 behavioral scenarios.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";

const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const srcRoot = join(coreRoot, "src");

function readText(relativeFromCore: string): string {
  return readFileSync(join(coreRoot, relativeFromCore), "utf8");
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

test("FEOD layer roots exist under src (library profile)", () => {
  for (const layer of ["app", "modules", "common", "globals", "pages"] as const) {
    expect(existsSync(join(srcRoot, layer)), `missing src/${layer}`).toBe(true);
  }
});

test("pages is an empty stub (no domain logic), not commands", () => {
  const pagesDir = join(srcRoot, "pages");
  expect(existsSync(pagesDir)).toBe(true);
  expect(statSync(pagesDir).isDirectory()).toBe(true);

  const tsFiles = listFilesRecursive(pagesDir).filter((f) => f.endsWith(".ts"));
  expect(tsFiles, "pages must not host domain .ts files").toEqual([]);

  const feod = JSON.parse(readText("package.json")) as {
    feod?: { layerDirs?: { pages?: string } };
  };
  expect(feod.feod?.layerDirs?.pages).toBe("pages");
});

test("package.json has library feod block (pages→pages, not commands)", () => {
  const pkg = JSON.parse(readText("package.json")) as {
    feod?: {
      srcRoot?: string;
      aliasPrefix?: string;
      layerDirs?: Record<string, string>;
      common?: { allowIndex?: boolean };
      modules?: {
        publicEntry?: string;
        allowDeepImports?: boolean;
        singleFileModules?: boolean;
      };
      pages?: {
        useFileBasedRouting?: boolean;
        modulePages?: boolean;
        privateModulesPrefix?: null;
      };
    };
  };

  expect(pkg.feod).toBeTruthy();
  expect(pkg.feod?.srcRoot).toBe("src");
  expect(pkg.feod?.aliasPrefix).toBe("@");
  expect(pkg.feod?.layerDirs).toEqual({
    app: "app",
    pages: "pages",
    modules: "modules",
    common: "common",
    global: "globals",
  });
  expect(pkg.feod?.common?.allowIndex).toBe(false);
  expect(pkg.feod?.modules?.publicEntry).toBe("index.ts");
  expect(pkg.feod?.modules?.allowDeepImports).toBe(false);
  expect(pkg.feod?.modules?.singleFileModules).toBe(false);
  expect(pkg.feod?.pages?.useFileBasedRouting).toBe(false);
  expect(pkg.feod?.pages?.modulePages).toBe(false);
  expect(pkg.feod?.pages?.privateModulesPrefix).toBeNull();
});

test("tsconfig maps @/* to ./src/*", () => {
  const tsconfig = JSON.parse(readText("tsconfig.json")) as {
    compilerOptions?: { paths?: Record<string, string[]> };
  };
  expect(tsconfig.compilerOptions?.paths?.["@/*"]).toEqual(["./src/*"]);
});

test("Manifest, Lockfile, Resolver, Install, and Primitives are directory modules with index.ts", () => {
  for (const name of ["Manifest", "Lockfile", "Resolver", "Install", "Primitives"] as const) {
    const modDir = join(srcRoot, "modules", name);
    expect(existsSync(modDir), `missing modules/${name}`).toBe(true);
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

test("Lockfile does not deep-import Manifest internals (yaml / errors)", () => {
  const lockfileDir = join(srcRoot, "modules", "Lockfile");
  expect(existsSync(lockfileDir), "modules/Lockfile must exist").toBe(true);

  const offenders: string[] = [];
  for (const file of listFilesRecursive(lockfileDir).filter((f) => f.endsWith(".ts"))) {
    const src = readFileSync(file, "utf8");
    const forbidden =
      /from\s+["'][^"']*modules\/Manifest\/(?!["'])|from\s+["'][^"']*manifest\/(yaml-load|errors)|from\s+["']\.\.\/manifest\//;
    if (forbidden.test(src)) {
      offenders.push(relative(srcRoot, file));
    }
  }
  expect(offenders).toEqual([]);
});

test("src/index.ts is a thin façade over app/publicApi", () => {
  expect(existsSync(join(srcRoot, "app", "publicApi.ts"))).toBe(true);
  const indexSrc = readText("src/index.ts");
  expect(indexSrc).toMatch(/app\/publicApi/);
  expect(indexSrc).not.toMatch(/from\s+["']\.\/manifest\//);
  expect(indexSrc).not.toMatch(/from\s+["']\.\/lockfile\//);
});
