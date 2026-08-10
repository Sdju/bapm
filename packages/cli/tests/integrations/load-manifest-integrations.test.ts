/**
 * Unit tests for object-map integration package loader.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createIntegrationRegistry } from "@b-apm/integration-api";
import {
  loadIntegrationFromPackage,
  ManifestIntegrationLoadError,
  globalModuleRootForCliEntry,
  registerManifestIntegrations,
} from "../../src/app/integrations/loadManifestIntegrations.ts";
import { isLocalPathSpecifier } from "../../src/app/integrations/localPathSpecifier.ts";

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

function installFixtureInGlobalRoot(
  cwd: string,
  fixtureDirName: string,
): {
  globalRoot: string;
  specifier: string;
} {
  const fixtureRoot = join(FIXTURES, fixtureDirName);
  const pkg = JSON.parse(readFileSync(join(fixtureRoot, "package.json"), "utf8")) as {
    name: string;
  };
  const globalRoot = join(cwd, "global", "lib", "node_modules");
  cpSync(fixtureRoot, join(globalRoot, ...pkg.name.split("/")), { recursive: true });
  return { globalRoot, specifier: pkg.name };
}

function plantLocalIntegration(
  cwd: string,
  relativeDir = "agents/integration/local-agent",
): string {
  const dest = join(cwd, relativeDir);
  mkdirSync(dirname(dest), { recursive: true });
  // Prefer a package with both `main` and `exports` so directory createRequire.resolve works.
  cpSync(join(FIXTURES, "create-integration-pkg"), dest, { recursive: true });
  const pkgPath = join(dest, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
  pkg.main = "./index.mjs";
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  return `./${relativeDir}`;
}

describe("isLocalPathSpecifier", () => {
  test("classifies ./ ../ and absolute as paths", () => {
    expect(isLocalPathSpecifier("./agents/foo")).toBe(true);
    expect(isLocalPathSpecifier("../outside")).toBe(true);
    expect(isLocalPathSpecifier("/tmp/abs")).toBe(true);
  });

  test("classifies bare and scoped as npm", () => {
    expect(isLocalPathSpecifier("my-integration")).toBe(false);
    expect(isLocalPathSpecifier("@acme/my-integration")).toBe(false);
    expect(isLocalPathSpecifier("agents/foo")).toBe(false);
  });
});

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

  test("loads a canonical integration from an isolated global module root", async () => {
    temp = createTemp();
    const { globalRoot, specifier } = installFixtureInGlobalRoot(
      temp.cwd,
      "create-integration-pkg",
    );

    const integration = await loadIntegrationFromPackage(specifier, "x-acme-editor", temp.cwd, {
      allowCliFallback: false,
      globalRoots: [globalRoot],
    });

    expect(integration.id).toBe("x-acme-editor");
  });

  test("derives a global module root only from the installed CLI entrypoint", () => {
    temp = createTemp();
    const entry = join(temp.cwd, "global", "node_modules", "@b-apm", "cli", "dist", "cli.mjs");

    expect(globalModuleRootForCliEntry(entry)).toBe(join(temp.cwd, "global", "node_modules"));
    expect(
      globalModuleRootForCliEntry(join(temp.cwd, "node_modules", "vite-plus", "bin", "vp.mjs")),
    ).toBe(undefined);
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

  test("loads in-root relative directory via Node resolution", async () => {
    temp = createTemp();
    const spec = plantLocalIntegration(temp.cwd);
    const integration = await loadIntegrationFromPackage(spec, "x-acme-editor", temp.cwd);
    expect(integration.id).toBe("x-acme-editor");
  });

  test("loads explicit .js/.mjs file under project root", async () => {
    temp = createTemp();
    plantLocalIntegration(temp.cwd);
    const spec = "./agents/integration/local-agent/index.mjs";
    const integration = await loadIntegrationFromPackage(spec, "x-acme-editor", temp.cwd);
    expect(integration.id).toBe("x-acme-editor");
  });

  test("fails closed on missing local path", async () => {
    temp = createTemp();
    const spec = "./agents/integration/missing";
    await expect(loadIntegrationFromPackage(spec, "x-pi-agent", temp.cwd)).rejects.toMatchObject({
      causeClass: "unresolvable",
      hostId: "x-pi-agent",
      specifier: spec,
    });
  });

  test("fails closed on ../ escape before import", async () => {
    temp = createTemp();
    const outside = join(dirname(temp.cwd), "unit-outside-integration");
    rmSync(outside, { recursive: true, force: true });
    mkdirSync(outside, { recursive: true });
    cpSync(join(FIXTURES, "create-integration-pkg"), outside, { recursive: true });
    try {
      const spec = "../unit-outside-integration";
      await expect(loadIntegrationFromPackage(spec, "x-acme-editor", temp.cwd)).rejects.toSatisfy(
        (err: unknown) => {
          expect(err).toMatchObject({
            causeClass: "unresolvable",
            hostId: "x-acme-editor",
            specifier: spec,
          });
          expect(String(err)).toMatch(/escap|project.?root|contain/i);
          return true;
        },
      );
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test("fails closed on absolute path outside project root", async () => {
    temp = createTemp();
    const outside = join(dirname(temp.cwd), "unit-abs-outside");
    rmSync(outside, { recursive: true, force: true });
    mkdirSync(outside, { recursive: true });
    cpSync(join(FIXTURES, "create-integration-pkg"), outside, { recursive: true });
    try {
      const spec = resolve(outside);
      await expect(loadIntegrationFromPackage(spec, "x-acme-editor", temp.cwd)).rejects.toSatisfy(
        (err: unknown) => {
          expect(err).toMatchObject({
            causeClass: "unresolvable",
            hostId: "x-acme-editor",
            specifier: spec,
          });
          expect(String(err)).toMatch(/escap|project.?root|contain/i);
          return true;
        },
      );
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test("bare / scoped npm strings still load from node_modules", async () => {
    temp = createTemp();
    const bare = linkFixture(temp.cwd, "create-integration-pkg");
    expect(isLocalPathSpecifier(bare)).toBe(false);
    const integration = await loadIntegrationFromPackage(bare, "x-acme-editor", temp.cwd);
    expect(integration.id).toBe("x-acme-editor");
  });

  test("absolute path inside project root is allowed", async () => {
    temp = createTemp();
    plantLocalIntegration(temp.cwd);
    const spec = resolve(temp.cwd, "agents/integration/local-agent");
    const integration = await loadIntegrationFromPackage(spec, "x-acme-editor", temp.cwd);
    expect(integration.id).toBe("x-acme-editor");
  });
});
