/**
 * plugin-scaffold — plugin-mode bapm.yml + consumer path unchanged + offline.
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { parse as parseYaml } from "yaml";
import {
  asRecord,
  core,
  createTempProject,
  existsSync,
  getCreateMinimalManifest,
  join,
  listFilesRecursive,
  readSrc,
  srcRoot,
  type TempProject,
} from "./helpers.ts";

describe("mp-plugin-init plugin-mode manifest", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("plugin-mode minimal manifest includes devDependencies.apm at 0.1.0", () => {
    const create = getCreateMinimalManifest();
    const doc = asRecord(
      create({
        name: "demo-plugin",
        version: "0.1.0",
        pluginMode: true,
      }),
    );

    expect(doc.name).toBe("demo-plugin");
    expect(doc.version).toBe("0.1.0");
    const deps = asRecord(doc.dependencies);
    expect(Array.isArray(deps.apm)).toBe(true);
    expect(Array.isArray(deps.mcp)).toBe(true);
    const devDeps = asRecord(doc.devDependencies);
    expect(Array.isArray(devDeps.apm)).toBe(true);
  });

  test("consumer minimal create remains without required devDependencies", () => {
    const create = getCreateMinimalManifest();
    const doc = asRecord(
      create({
        name: "consumer-pkg",
        version: "1.0.0",
      }),
    );
    expect(doc).not.toHaveProperty("devDependencies");
  });

  test("plugin-mode document serializes with deps + devDependencies", () => {
    const create = getCreateMinimalManifest();
    const doc = asRecord(create({ name: "demo-plugin", pluginMode: true, version: "0.1.0" }));
    const serialize = (core as Record<string, unknown>).serializeManifest;
    expect(typeof serialize).toBe("function");
    const yaml = String((serialize as (d: unknown) => string)(doc));
    const parsed = asRecord(parseYaml(yaml));
    expect(parsed.name).toBe("demo-plugin");
    expect(parsed.version).toBe("0.1.0");
    expect(parsed).toHaveProperty("devDependencies");
  });

  test("publicApi re-exports plugin scaffold helpers", () => {
    const publicApi = readSrc("app/publicApi.ts");
    expect(publicApi).toMatch(/validatePluginName/);
    expect(publicApi).toMatch(/createPluginJson|writePluginJson/);
  });

  test("new plugin helper sources stay offline (no network clients)", () => {
    project = createTempProject();
    const manifestDir = join(srcRoot, "modules", "Manifest");
    expect(existsSync(manifestDir)).toBe(true);

    // Soft-require that plugin-named helpers exist once apply lands.
    const files = listFilesRecursive(manifestDir).filter((f) => f.endsWith(".ts"));
    const pluginFiles = files.filter((f) => /plugin/i.test(f));
    expect(
      pluginFiles.length,
      "expected Manifest plugin helper source file(s) under modules/Manifest",
    ).toBeGreaterThan(0);

    for (const file of pluginFiles) {
      const body = readFileSync(file, "utf8");
      expect(body, file).not.toMatch(/\bfetch\s*\(/);
      expect(body, file).not.toMatch(/from\s+["']node:http["']/);
      expect(body, file).not.toMatch(/from\s+["']undici["']/);
      expect(body, file).not.toMatch(/fetchMarketplace|RegistryClient/);
    }
  });
});
