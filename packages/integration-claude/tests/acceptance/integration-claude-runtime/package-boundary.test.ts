/**
 * Package surface: runtime factory + marketplace mapper; core soft edge.
 */
import { describe, expect, test } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CORE_ROOT, PKG_ROOT, REPO_ROOT, loadClaudeModule } from "./helpers.ts";

describe("integration-claude-runtime · package boundary", () => {
  test("packages/integration-claude is @bapm/integration-claude with vite-plus tooling", () => {
    expect(existsSync(PKG_ROOT)).toBe(true);
    const pkgPath = join(PKG_ROOT, "package.json");
    expect(existsSync(pkgPath)).toBe(true);
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      name?: string;
      type?: string;
      description?: string;
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(pkg.name).toBe("@bapm/integration-claude");
    expect(pkg.type).toBe("module");
    expect(pkg.dependencies?.["@bapm/integration-api"]).toBeTruthy();
    expect(pkg.dependencies?.["@bapm/core"]).toBeUndefined();
    expect(JSON.stringify(pkg.scripts ?? {})).toMatch(/vp/);
    expect(String(pkg.description ?? "")).toMatch(/runtime/i);
  });

  test("exports createClaudeIntegration / createIntegration with id claude", async () => {
    const mod = await loadClaudeModule();
    expect(typeof mod.createClaudeIntegration).toBe("function");
    expect(typeof (mod.createIntegration ?? mod.createClaudeIntegration)).toBe("function");
    const target = (mod.createClaudeIntegration ?? mod.createIntegration)!();
    expect(target.id).toBe("claude");
    expect(typeof target.detect).toBe("function");
    expect(typeof target.materialize).toBe("function");
    expect(target.deployRoots).toEqual(expect.arrayContaining([".claude", "."]));
  });

  test("marketplace mapper remains available without runtime activation", async () => {
    const mod = await loadClaudeModule();
    expect(mod.claudeMarketplaceIntegration).toMatchObject({
      id: "claude",
      marketplaceOutput: {
        format: "claude",
        defaultOutput: ".claude-plugin/marketplace.json",
      },
    });
    expect(typeof mod.mapClaudeMarketplace).toBe("function");
    const doc = mod.mapClaudeMarketplace!({ name: "M", owner: "Bapm" }, [
      {
        name: "plug",
        entry: { version: "1.0.0" },
        isLocal: true,
        source: "./plugins/plug",
      },
    ]);
    expect(doc).toMatchObject({
      name: "M",
      owner: { name: "Bapm" },
      plugins: [{ name: "plug", source: "./plugins/plug" }],
    });
  });

  test("@bapm/core must not hard-depend on @bapm/integration-claude", () => {
    const corePkg = JSON.parse(readFileSync(join(CORE_ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(corePkg.dependencies).not.toHaveProperty("@bapm/integration-claude");

    const viteConfig = readFileSync(join(CORE_ROOT, "vite.config.ts"), "utf8");
    expect(viteConfig).not.toMatch(/["']@bapm\/integration-claude["']\s*:/);
  });

  test("workspace package directory is present under packages/", () => {
    expect(existsSync(join(REPO_ROOT, "packages/integration-claude/package.json"))).toBe(true);
  });
});
