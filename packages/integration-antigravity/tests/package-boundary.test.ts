/**
 * Package boundary: depends on integration-api only; not imported by core.
 * (promoted from integration-antigravity-runtime acceptance).
 */
import { describe, expect, test } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");
const repoRoot = join(pkgRoot, "../..");

describe("antigravity package boundary", () => {
  test("package depends on @b-apm/integration-api and not @b-apm/core", () => {
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as {
      name: string;
      dependencies?: Record<string, string>;
    };
    expect(pkg.name).toBe("@b-apm/integration-antigravity");
    expect(pkg.dependencies?.["@b-apm/integration-api"]).toBeTruthy();
    expect(pkg.dependencies?.["@b-apm/core"]).toBeUndefined();
  });

  test("core package.json does not depend on integration-antigravity", () => {
    const core = JSON.parse(readFileSync(join(repoRoot, "packages/core/package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(core.dependencies?.["@b-apm/integration-antigravity"]).toBeUndefined();
    expect(core.devDependencies?.["@b-apm/integration-antigravity"]).toBeUndefined();
  });
});
