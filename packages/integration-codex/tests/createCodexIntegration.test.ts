/**
 * @b-apm/integration-codex package identity + factory surface
 * (detect/materialize/hooks/mcp/compile live in sibling suites;
 * promoted from integration-codex-runtime acceptance).
 */
import { describe, expect, test } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCodexIntegration } from "../src/createCodexIntegration.ts";
import { createIntegration } from "../src/index.ts";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pkgRoot, "../..");
const coreRoot = join(repoRoot, "packages/core");

describe("@b-apm/integration-codex package", () => {
  test("package is @b-apm/integration-codex with integration-api dep and no core hard-dep", () => {
    expect(existsSync(pkgRoot)).toBe(true);
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as {
      name?: string;
      type?: string;
      description?: string;
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(pkg.name).toBe("@b-apm/integration-codex");
    expect(pkg.type).toBe("module");
    expect(pkg.dependencies?.["@b-apm/integration-api"]).toBeTruthy();
    expect(pkg.dependencies?.["@b-apm/core"]).toBeUndefined();
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

  test("@b-apm/core must not hard-depend on @b-apm/integration-codex", () => {
    const corePkg = JSON.parse(readFileSync(join(coreRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(corePkg.dependencies).not.toHaveProperty("@b-apm/integration-codex");

    const viteConfig = readFileSync(join(coreRoot, "vite.config.ts"), "utf8");
    expect(viteConfig).not.toMatch(/["']@b-apm\/integration-codex["']\s*:/);
  });
});
