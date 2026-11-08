/**
 * Package identity / thin surface for @b-apm/integration-hermes.
 */
import { describe, expect, test } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHermesIntegration, createIntegration } from "../src/index.ts";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pkgRoot, "../..");
const coreRoot = join(repoRoot, "packages/core");

describe("@b-apm/integration-hermes package boundary", () => {
  test("package is @b-apm/integration-hermes with integration-api + yaml (no core hard-dep)", () => {
    expect(existsSync(pkgRoot)).toBe(true);
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as {
      name?: string;
      type?: string;
      description?: string;
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(pkg.name).toBe("@b-apm/integration-hermes");
    expect(pkg.type).toBe("module");
    expect(pkg.dependencies?.["@b-apm/integration-api"]).toBeTruthy();
    expect(pkg.dependencies?.yaml).toBeTruthy();
    expect(pkg.dependencies?.["@b-apm/core"]).toBeUndefined();
    expect(JSON.stringify(pkg.scripts ?? {})).toMatch(/vp/);
    expect(String(pkg.description ?? "")).toMatch(/hermes/i);
  });

  test("createIntegration aliases createHermesIntegration with skills/MCP/compile", () => {
    expect(createIntegration).toBe(createHermesIntegration);
    const target = createHermesIntegration();
    expect(target.id).toBe("hermes");
    expect(typeof target.detect).toBe("function");
    expect(typeof target.materialize).toBe("function");
    expect(target.configureMcp).toBeDefined();
    expect(target.compile).toBeDefined();
    expect(target.mcpScope).toBe("home");
    expect(target.deployRoots).toEqual([".agents"]);
  });

  test("@b-apm/core must not hard-depend on @b-apm/integration-hermes", () => {
    const corePkg = JSON.parse(readFileSync(join(coreRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(corePkg.dependencies).not.toHaveProperty("@b-apm/integration-hermes");

    const viteConfig = readFileSync(join(coreRoot, "vite.config.ts"), "utf8");
    expect(viteConfig).not.toMatch(/["']@b-apm\/integration-hermes["']\s*:/);
  });
});
