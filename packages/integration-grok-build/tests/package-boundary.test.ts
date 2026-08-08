/**
 * Package identity / registry surface for @bapm/integration-grok-build.
 */
import { describe, expect, test } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGrokBuildIntegration, createIntegration } from "../src/index.ts";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pkgRoot, "../..");
const coreRoot = join(repoRoot, "packages/core");

describe("@bapm/integration-grok-build package boundary", () => {
  test("package is @bapm/integration-grok-build with integration-api only (no core hard-dep)", () => {
    expect(existsSync(pkgRoot)).toBe(true);
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as {
      name?: string;
      type?: string;
      description?: string;
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(pkg.name).toBe("@bapm/integration-grok-build");
    expect(pkg.type).toBe("module");
    expect(pkg.dependencies?.["@bapm/integration-api"]).toBeTruthy();
    expect(pkg.dependencies?.["@bapm/core"]).toBeUndefined();
    expect(JSON.stringify(pkg.scripts ?? {})).toMatch(/vp/);
    expect(String(pkg.description ?? "")).toMatch(/grok/i);
  });

  test("createIntegration aliases createGrokBuildIntegration with id grok-build and no configureMcp", () => {
    expect(createIntegration).toBe(createGrokBuildIntegration);
    const target = createGrokBuildIntegration();
    expect(target.id).toBe("grok-build");
    expect(typeof target.detect).toBe("function");
    expect(typeof target.materialize).toBe("function");
    expect(typeof target.compile).toBe("function");
    expect(target.configureMcp).toBeUndefined();
    expect(target.deployRoots).toEqual(expect.arrayContaining([".grok", "."]));
  });

  test("@bapm/core must not hard-depend on @bapm/integration-grok-build", () => {
    const corePkg = JSON.parse(readFileSync(join(coreRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(corePkg.dependencies).not.toHaveProperty("@bapm/integration-grok-build");
  });
});
