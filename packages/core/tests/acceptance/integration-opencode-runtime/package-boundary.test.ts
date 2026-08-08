/**
 * Package boundary: @bapm/integration-opencode exists, API-only dep, core soft edge.
 */
import { describe, expect, test } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CORE_ROOT, OPENCODE_PKG_ROOT, REPO_ROOT, loadOpencodeModule } from "./helpers.ts";

describe("integration-opencode-runtime · package boundary", () => {
  test("packages/integration-opencode is @bapm/integration-opencode with vite-plus tooling", () => {
    expect(existsSync(OPENCODE_PKG_ROOT)).toBe(true);
    const pkgPath = join(OPENCODE_PKG_ROOT, "package.json");
    expect(existsSync(pkgPath)).toBe(true);
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      name?: string;
      type?: string;
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(pkg.name).toBe("@bapm/integration-opencode");
    expect(pkg.type).toBe("module");
    expect(pkg.dependencies?.["@bapm/integration-api"]).toBeTruthy();
    expect(pkg.dependencies?.["@bapm/core"]).toBeUndefined();
    expect(JSON.stringify(pkg.scripts ?? {})).toMatch(/vp/);
  });

  test("exports createOpencodeIntegration and createIntegration", async () => {
    const mod = await loadOpencodeModule();
    expect(typeof mod.createOpencodeIntegration).toBe("function");
    expect(typeof (mod.createIntegration ?? mod.createOpencodeIntegration)).toBe("function");
    const target = mod.createOpencodeIntegration!();
    expect(target.id).toBe("opencode");
    expect(target.deployRoots).toEqual(expect.arrayContaining([".opencode", "."]));
  });

  test("@bapm/core must not hard-depend on @bapm/integration-opencode", () => {
    const corePkg = JSON.parse(readFileSync(join(CORE_ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(corePkg.dependencies).not.toHaveProperty("@bapm/integration-opencode");

    const viteConfig = readFileSync(join(CORE_ROOT, "vite.config.ts"), "utf8");
    expect(viteConfig).not.toMatch(/["']@bapm\/integration-opencode["']\s*:/);
  });

  test("workspace package directory is present under packages/", () => {
    expect(existsSync(join(REPO_ROOT, "packages/integration-opencode/package.json"))).toBe(true);
  });
});
