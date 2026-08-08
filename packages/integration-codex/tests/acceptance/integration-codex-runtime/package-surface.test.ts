/**
 * Package dual surface: runtime factory + retained marketplace mapper;
 * core must not hard-depend on @bapm/integration-codex.
 */
import { describe, expect, test } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  codexMarketplaceIntegration,
  createIntegration,
  mapCodexMarketplace,
} from "../../../src/index.ts";
import { createCodexIntegration } from "../../../src/createCodexIntegration.ts";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const repoRoot = resolve(pkgRoot, "../..");
const coreRoot = join(repoRoot, "packages/core");

describe("@bapm/integration-codex package surface", () => {
  test("package is @bapm/integration-codex with integration-api dep and no core hard-dep", () => {
    expect(existsSync(pkgRoot)).toBe(true);
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as {
      name?: string;
      type?: string;
      description?: string;
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(pkg.name).toBe("@bapm/integration-codex");
    expect(pkg.type).toBe("module");
    expect(pkg.dependencies?.["@bapm/integration-api"]).toBeTruthy();
    expect(pkg.dependencies?.["@bapm/core"]).toBeUndefined();
    expect(JSON.stringify(pkg.scripts ?? {})).toMatch(/vp/);
    expect(String(pkg.description ?? "")).toMatch(/runtime/i);
  });

  test("createIntegration aliases createCodexIntegration with id codex and deploy roots", () => {
    expect(createIntegration).toBe(createCodexIntegration);
    const target = createCodexIntegration();
    expect(target.id).toBe("codex");
    expect(typeof target.detect).toBe("function");
    expect(typeof target.materialize).toBe("function");
    expect(typeof target.configureMcp).toBe("function");
    expect(typeof target.compile).toBe("function");
    expect(target.deployRoots).toEqual(expect.arrayContaining([".codex", ".agents", "."]));
  });

  test("marketplace mapper remains available without requiring runtime activation", () => {
    expect(codexMarketplaceIntegration).toMatchObject({
      id: "codex",
      marketplaceOutput: {
        format: "codex",
        defaultOutput: ".agents/plugins/marketplace.json",
      },
    });
    expect(typeof mapCodexMarketplace).toBe("function");
    expect(
      mapCodexMarketplace({ name: "Example marketplace" }, [
        {
          name: "example-plugin",
          entry: { category: "development" },
          isLocal: true,
          source: "./plugins/example-plugin",
        },
      ]),
    ).toMatchObject({
      name: "Example marketplace",
      plugins: [{ name: "example-plugin", category: "development" }],
    });
  });

  test("@bapm/core must not hard-depend on @bapm/integration-codex", () => {
    const corePkg = JSON.parse(readFileSync(join(coreRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(corePkg.dependencies).not.toHaveProperty("@bapm/integration-codex");

    const viteConfig = readFileSync(join(coreRoot, "vite.config.ts"), "utf8");
    expect(viteConfig).not.toMatch(/["']@bapm\/integration-codex["']\s*:/);
  });
});
