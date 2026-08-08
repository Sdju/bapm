/**
 * Package identity / registry surface for @bapm/integration-gemini
 * (integration-gemini-runtime acceptance).
 */
import { describe, expect, test } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGeminiIntegration, createIntegration } from "../../../src/index.ts";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const repoRoot = resolve(pkgRoot, "../..");
const coreRoot = join(repoRoot, "packages/core");

describe("@bapm/integration-gemini package boundary", () => {
  test("package is @bapm/integration-gemini with integration-api only (no core hard-dep)", () => {
    expect(existsSync(pkgRoot)).toBe(true);
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as {
      name?: string;
      type?: string;
      description?: string;
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(pkg.name).toBe("@bapm/integration-gemini");
    expect(pkg.type).toBe("module");
    expect(pkg.dependencies?.["@bapm/integration-api"]).toBeTruthy();
    expect(pkg.dependencies?.["@bapm/core"]).toBeUndefined();
    expect(JSON.stringify(pkg.scripts ?? {})).toMatch(/vp/);
    expect(String(pkg.description ?? "")).toMatch(/gemini|runtime/i);
  });

  test("createIntegration aliases createGeminiIntegration with id gemini and deploy roots", () => {
    expect(createIntegration).toBe(createGeminiIntegration);
    const target = createGeminiIntegration();
    expect(target.id).toBe("gemini");
    expect(typeof target.detect).toBe("function");
    expect(typeof target.materialize).toBe("function");
    expect(typeof target.configureMcp).toBe("function");
    expect(typeof target.compile).toBe("function");
    expect(target.deployRoots).toEqual(expect.arrayContaining([".gemini", ".agents", "."]));
  });

  test("@bapm/core must not hard-depend on @bapm/integration-gemini", () => {
    const corePkg = JSON.parse(readFileSync(join(coreRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(corePkg.dependencies).not.toHaveProperty("@bapm/integration-gemini");

    const viteConfig = readFileSync(join(coreRoot, "vite.config.ts"), "utf8");
    expect(viteConfig).not.toMatch(/["']@bapm\/integration-gemini["']\s*:/);
  });
});
