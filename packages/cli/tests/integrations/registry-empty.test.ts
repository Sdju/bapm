/**
 * Composition root registries start empty; CLI has no hard deps on concrete integrations
 * (promoted from opt-in-host-integrations acceptance).
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";
import { createCliIntegrationRegistry } from "../../src/app/integrations/registry.ts";
import { createCliMarketplaceOutputRegistry } from "../../src/app/integrations/marketplaceOutputs.ts";

const CLI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const CONCRETE_INTEGRATIONS = [
  "@bapm/integration-cursor",
  "@bapm/integration-claude",
  "@bapm/integration-codex",
] as const;

function readCliPackageJson(): {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
} {
  return JSON.parse(readFileSync(join(CLI_ROOT, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
  };
}

describe("CLI · empty composition registries (opt-in hosts)", () => {
  test("createCliIntegrationRegistry starts with no eager host registrations", () => {
    const registry = createCliIntegrationRegistry();
    const ids = registry.list().map((t) => t.id);
    expect(ids).toEqual([]);
    expect(registry.get("cursor")).toBeUndefined();
  });

  test("createCliMarketplaceOutputRegistry starts with no static Claude/Codex registrations", () => {
    const registry = createCliMarketplaceOutputRegistry();
    const formats = registry.list().map((t) => t.marketplaceOutput.format);
    expect(formats).toEqual([]);
    expect(registry.get("claude")).toBeUndefined();
    expect(registry.get("codex")).toBeUndefined();
  });

  test("CLI package.json has no hard deps on concrete @bapm/integration-* packages", () => {
    const pkg = readCliPackageJson();
    const deps = { ...pkg.dependencies, ...pkg.optionalDependencies };
    for (const name of CONCRETE_INTEGRATIONS) {
      expect(deps[name], `${name} must not be a CLI hard/optional dependency`).toBeUndefined();
    }
    expect(deps["@bapm/integration-api"]).toBeTruthy();
  });

  test("runtime registry module does not static-import @bapm/integration-cursor", () => {
    const src = readFileSync(join(CLI_ROOT, "src/app/integrations/registry.ts"), "utf8");
    expect(src).not.toMatch(/@bapm\/integration-cursor/);
    expect(src).not.toMatch(/createCursorIntegration/);
  });

  test("marketplaceOutputs module does not static-import Claude/Codex packages", () => {
    const src = readFileSync(join(CLI_ROOT, "src/app/integrations/marketplaceOutputs.ts"), "utf8");
    expect(src).not.toMatch(/@bapm\/integration-claude/);
    expect(src).not.toMatch(/@bapm\/integration-codex/);
  });
});
