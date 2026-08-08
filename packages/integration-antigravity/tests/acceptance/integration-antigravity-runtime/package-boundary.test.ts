/**
 * Package boundary: depends on integration-api only; not imported by core.
 */
import { describe, expect, test } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "../../..");
const repoRoot = join(pkgRoot, "../..");

describe("antigravity package boundary", () => {
  test("package depends on @bapm/integration-api and not @bapm/core", () => {
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as {
      name: string;
      dependencies?: Record<string, string>;
    };
    expect(pkg.name).toBe("@bapm/integration-antigravity");
    expect(pkg.dependencies?.["@bapm/integration-api"]).toBeTruthy();
    expect(pkg.dependencies?.["@bapm/core"]).toBeUndefined();
  });

  test("core package.json does not depend on integration-antigravity", () => {
    const core = JSON.parse(readFileSync(join(repoRoot, "packages/core/package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(core.dependencies?.["@bapm/integration-antigravity"]).toBeUndefined();
    expect(core.devDependencies?.["@bapm/integration-antigravity"]).toBeUndefined();
  });
});
