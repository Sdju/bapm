/**
 * @b-apm/integration-opencode package identity
 * (detect/materialize/mcp/compile live in sibling suites).
 */
import { expect, test, describe } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createIntegration, createOpencodeIntegration } from "../src/index.ts";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("@b-apm/integration-opencode package", () => {
  test("package is @b-apm/integration-opencode with vite-plus tooling", () => {
    expect(existsSync(pkgRoot)).toBe(true);
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as {
      name?: string;
      type?: string;
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(pkg.name).toBe("@b-apm/integration-opencode");
    expect(pkg.type).toBe("module");
    expect(pkg.dependencies?.["@b-apm/integration-api"]).toBeTruthy();
    expect(pkg.dependencies?.["@b-apm/core"]).toBeUndefined();
    expect(JSON.stringify(pkg.scripts ?? {})).toMatch(/vp/);
  });

  test("createIntegration aliases createOpencodeIntegration", () => {
    expect(createIntegration).toBe(createOpencodeIntegration);
    const target = createOpencodeIntegration();
    expect(target.id).toBe("opencode");
    expect(typeof target.compile).toBe("function");
    expect(target.deployRoots).toEqual(expect.arrayContaining([".opencode", "."]));
  });
});
