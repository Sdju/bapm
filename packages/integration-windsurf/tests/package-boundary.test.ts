/**
 * Package identity / registry surface for @bapm/integration-windsurf.
 */
import { describe, expect, test } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createIntegration, createWindsurfIntegration } from "../src/index.ts";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pkgRoot, "../..");
const coreRoot = join(repoRoot, "packages/core");

describe("@bapm/integration-windsurf package boundary", () => {
  test("package is @bapm/integration-windsurf with integration-api only (no core hard-dep)", () => {
    expect(existsSync(pkgRoot)).toBe(true);
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as {
      name?: string;
      type?: string;
      description?: string;
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(pkg.name).toBe("@bapm/integration-windsurf");
    expect(pkg.type).toBe("module");
    expect(pkg.dependencies?.["@bapm/integration-api"]).toBeTruthy();
    expect(pkg.dependencies?.["@bapm/core"]).toBeUndefined();
    expect(JSON.stringify(pkg.scripts ?? {})).toMatch(/vp/);
    expect(String(pkg.description ?? "")).toMatch(/windsurf|runtime/i);
  });

  test("createIntegration aliases createWindsurfIntegration with id windsurf and deploy roots", () => {
    expect(createIntegration).toBe(createWindsurfIntegration);
    const target = createWindsurfIntegration();
    expect(target.id).toBe("windsurf");
    expect(typeof target.detect).toBe("function");
    expect(typeof target.materialize).toBe("function");
    expect(typeof target.configureMcp).toBe("function");
    expect(target.deployRoots).toEqual(expect.arrayContaining([".windsurf", ".agents"]));
    expect(target.deployRoots).not.toContain(".");
    expect((target as { mcpEnvMode?: string }).mcpEnvMode).not.toBe("translate");
  });

  test("@bapm/core must not hard-depend on @bapm/integration-windsurf", () => {
    const corePkg = JSON.parse(readFileSync(join(coreRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(corePkg.dependencies).not.toHaveProperty("@bapm/integration-windsurf");

    const viteConfig = readFileSync(join(coreRoot, "vite.config.ts"), "utf8");
    expect(viteConfig).not.toMatch(/["']@bapm\/integration-windsurf["']\s*:/);
  });
});
