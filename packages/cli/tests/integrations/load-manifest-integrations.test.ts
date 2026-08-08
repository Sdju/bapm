/**
 * Unit tests for object-map integration package loader.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createIntegrationRegistry } from "@bapm/integration-api";
import {
  loadIntegrationFromPackage,
  ManifestIntegrationLoadError,
  registerManifestIntegrations,
} from "../../src/app/integrations/loadManifestIntegrations.ts";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

type Temp = { cwd: string; cleanup: () => void };

function createTemp(): Temp {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-unit-map-load-"));
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

function linkFixture(cwd: string, fixtureDirName: string): string {
  const fixtureRoot = join(FIXTURES, fixtureDirName);
  const pkg = JSON.parse(readFileSync(join(fixtureRoot, "package.json"), "utf8")) as {
    name: string;
  };
  const dest = join(cwd, "node_modules", ...pkg.name.split("/"));
  mkdirSync(dirname(dest), { recursive: true });
  symlinkSync(fixtureRoot, dest, "dir");
  return pkg.name;
}

describe("loadManifestIntegrations", () => {
  let temp: Temp | undefined;

  afterEach(() => {
    temp?.cleanup();
    temp = undefined;
  });

  test("loads createIntegration factory", async () => {
    temp = createTemp();
    const spec = linkFixture(temp.cwd, "create-integration-pkg");
    const integration = await loadIntegrationFromPackage(spec, "x-acme-editor", temp.cwd);
    expect(integration.id).toBe("x-acme-editor");
    expect(typeof integration.detect).toBe("function");
    expect(typeof integration.materialize).toBe("function");
  });

  test("loads default-export integration object", async () => {
    temp = createTemp();
    const spec = linkFixture(temp.cwd, "default-export-pkg");
    const integration = await loadIntegrationFromPackage(spec, "x-acme-default", temp.cwd);
    expect(integration.id).toBe("x-acme-default");
  });

  test("fails closed on unresolvable specifier", async () => {
    temp = createTemp();
    await expect(
      loadIntegrationFromPackage("@acme/does-not-exist-unit", "x-missing", temp.cwd),
    ).rejects.toMatchObject({
      name: "ManifestIntegrationLoadError",
      causeClass: "unresolvable",
      hostId: "x-missing",
      specifier: "@acme/does-not-exist-unit",
    });
  });

  test("rejects marketplace-only export", async () => {
    temp = createTemp();
    const spec = linkFixture(temp.cwd, "marketplace-only-pkg");
    await expect(loadIntegrationFromPackage(spec, "x-acme-market", temp.cwd)).rejects.toMatchObject(
      {
        causeClass: "marketplace_only",
        hostId: "x-acme-market",
        specifier: spec,
      },
    );
  });

  test("rejects id mismatch", async () => {
    temp = createTemp();
    const spec = linkFixture(temp.cwd, "id-mismatch-pkg");
    await expect(loadIntegrationFromPackage(spec, "x-acme-editor", temp.cwd)).rejects.toMatchObject(
      {
        causeClass: "id_mismatch",
        hostId: "x-acme-editor",
        specifier: spec,
      },
    );
  });

  test("registerManifestIntegrations registers map entries", async () => {
    temp = createTemp();
    const spec = linkFixture(temp.cwd, "create-integration-pkg");
    const registry = createIntegrationRegistry();
    await registerManifestIntegrations(
      registry,
      {
        name: "unit",
        version: "0.0.1",
        targets: { "x-acme-editor": spec },
        dependencies: { apm: [] },
      } as never,
      temp.cwd,
    );
    expect(registry.get("x-acme-editor")?.id).toBe("x-acme-editor");
  });

  test("ManifestIntegrationLoadError message names id, specifier, cause", () => {
    const err = new ManifestIntegrationLoadError(
      "x-acme",
      "@acme/pkg",
      "unresolvable",
      "cannot find module",
    );
    expect(err.message).toContain("x-acme");
    expect(err.message).toContain("@acme/pkg");
    expect(err.message).toContain("unresolvable");
  });
});
