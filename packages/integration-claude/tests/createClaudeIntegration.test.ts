/**
 * @b-apm/integration-claude package identity + rules transform helper
 * (detect/materialize/hooks/mcp/compile live in sibling suites).
 */
import { describe, expect, test } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createClaudeIntegration,
  transformClaudeRulesMarkdown,
} from "../src/createClaudeIntegration.ts";
import { createIntegration } from "../src/index.ts";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pkgRoot, "../..");
const coreRoot = join(repoRoot, "packages/core");

describe("@b-apm/integration-claude package", () => {
  test("package is @b-apm/integration-claude with vite-plus tooling", () => {
    expect(existsSync(pkgRoot)).toBe(true);
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as {
      name?: string;
      type?: string;
      description?: string;
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(pkg.name).toBe("@b-apm/integration-claude");
    expect(pkg.type).toBe("module");
    expect(pkg.dependencies?.["@b-apm/integration-api"]).toBeTruthy();
    expect(pkg.dependencies?.["@b-apm/core"]).toBeUndefined();
    expect(JSON.stringify(pkg.scripts ?? {})).toMatch(/vp/);
    expect(String(pkg.description ?? "")).toMatch(/runtime/i);
  });

  test("createIntegration aliases createClaudeIntegration", () => {
    expect(createIntegration).toBe(createClaudeIntegration);
    const target = createClaudeIntegration();
    expect(target.id).toBe("claude");
    expect(typeof target.detect).toBe("function");
    expect(typeof target.materialize).toBe("function");
    expect(target.deployRoots).toEqual(expect.arrayContaining([".claude", "."]));
  });

  test("@b-apm/core must not hard-depend on @b-apm/integration-claude", () => {
    const corePkg = JSON.parse(readFileSync(join(coreRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(corePkg.dependencies).not.toHaveProperty("@b-apm/integration-claude");

    const viteConfig = readFileSync(join(coreRoot, "vite.config.ts"), "utf8");
    expect(viteConfig).not.toMatch(/["']@bapm\/integration-claude["']\s*:/);
  });
});

describe("transformClaudeRulesMarkdown", () => {
  test("maps applyTo list to paths", () => {
    const out = transformClaudeRulesMarkdown(
      '---\napplyTo:\n  - "**/*.ts"\n  - "src/**"\n---\n# Body\n',
    );
    expect(out).toMatch(/^paths:\s*$/m);
    expect(out).toMatch(/\*\*\/\*\.ts/);
    expect(out).not.toMatch(/^applyTo:/m);
  });

  test("leaves unconditional body without paths", () => {
    const out = transformClaudeRulesMarkdown("# Only body\n");
    expect(out).toBe("# Only body\n");
    expect(out).not.toMatch(/^paths:/m);
  });
});
