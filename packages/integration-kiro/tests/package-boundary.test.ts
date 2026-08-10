/**
 * Package identity / registry surface for @b-apm/integration-kiro.
 */
import { describe, expect, test } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadKiroIntegration } from "./helpers.ts";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("@b-apm/integration-kiro package boundary", () => {
  test("package is @b-apm/integration-kiro with integration-api only (no core hard-dep)", () => {
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as {
      name: string;
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(pkg.name).toBe("@b-apm/integration-kiro");
    expect(pkg.dependencies).toEqual({ "@b-apm/integration-api": "workspace:*" });
    expect(pkg.dependencies).not.toHaveProperty("@b-apm/core");
    expect(pkg.scripts?.test).toMatch(/vp test/);
  });

  test("factory defaults: id kiro, deployRoots include .kiro, mcpEnvMode translate", () => {
    const target = loadKiroIntegration();
    expect(target.id).toBe("kiro");
    expect(target.deployRoots).toContain(".kiro");
    expect(target.mcpEnvMode).toBe("translate");
    expect(typeof target.detect).toBe("function");
    expect(typeof target.materialize).toBe("function");
    expect(typeof target.configureMcp).toBe("function");
    expect(typeof target.compile).toBe("function");
  });

  test("@b-apm/core must not hard-depend on @b-apm/integration-kiro", () => {
    const corePkg = JSON.parse(readFileSync(join(pkgRoot, "../core/package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(corePkg.dependencies).not.toHaveProperty("@b-apm/integration-kiro");
  });
});
