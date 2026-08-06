/**
 * Unit tests — plugin name validation, plugin.json, plugin-mode minimal manifest.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  createMinimalManifest,
  createPluginJson,
  serializeManifest,
  validatePluginName,
  validateProjectName,
  writePluginJson,
} from "../../src/index.ts";

const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const srcRoot = join(coreRoot, "src");

function listFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

describe("Manifest plugin name validation", () => {
  test("accepts kebab-case ids", () => {
    expect(validatePluginName("my-plugin").ok).toBe(true);
    expect(validatePluginName("a").ok).toBe(true);
    expect(validatePluginName("demo-plugin-01").ok).toBe(true);
  });

  test("rejects invalid shapes", () => {
    expect(validatePluginName("MyPlugin").ok).toBe(false);
    expect(validatePluginName("my_plugin").ok).toBe(false);
    expect(validatePluginName("1bad").ok).toBe(false);
    expect(validatePluginName("-bad").ok).toBe(false);
    expect(validatePluginName("").ok).toBe(false);
    expect(validatePluginName(`a${"b".repeat(64)}`).ok).toBe(false);
  });

  test("project name rejects path separators and ..", () => {
    expect(validateProjectName("my-plugin").ok).toBe(true);
    expect(validateProjectName("foo/bar").ok).toBe(false);
    expect(validateProjectName("foo\\bar").ok).toBe(false);
    expect(validateProjectName("..").ok).toBe(false);
    expect(validateProjectName("foo/../bar").ok).toBe(false);
  });
});

describe("Manifest plugin.json writer", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("createPluginJson defaults version 0.1.0 and MIT license", () => {
    const doc = createPluginJson({ name: "demo-plugin" });
    expect(doc).toEqual({
      name: "demo-plugin",
      version: "0.1.0",
      description: "",
      author: { name: "author" },
      license: "MIT",
    });
  });

  test("writePluginJson emits indent-2 JSON with trailing newline", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-plugin-json-"));
    const path = join(cwd, "plugin.json");
    writePluginJson({
      cwd,
      path,
      name: "demo-plugin",
      version: "0.1.0",
      description: "Demo",
      author: { name: "author" },
      license: "MIT",
    });
    expect(existsSync(path)).toBe(true);
    const raw = readFileSync(path, "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw).toMatch(/\{\n {2}"name"/);
    expect(JSON.parse(raw).name).toBe("demo-plugin");
  });
});

describe("Manifest plugin-mode createMinimalManifest", () => {
  test("pluginMode emits devDependencies.apm", () => {
    const doc = createMinimalManifest({
      name: "demo-plugin",
      version: "0.1.0",
      pluginMode: true,
    });
    expect(doc.devDependencies).toEqual({ apm: [] });
    expect(doc.dependencies).toEqual({ apm: [], mcp: [] });
    expect(doc.includes).toBe("auto");
    expect(doc.scripts).toEqual({});
  });

  test("consumer path omits devDependencies", () => {
    const doc = createMinimalManifest({ name: "consumer-pkg", version: "1.0.0" });
    expect(doc).not.toHaveProperty("devDependencies");
  });

  test("plugin-mode serializes with deps + devDependencies", () => {
    const doc = createMinimalManifest({
      name: "demo-plugin",
      pluginMode: true,
      version: "0.1.0",
    });
    const parsed = parseYaml(serializeManifest(doc)) as Record<string, unknown>;
    expect(parsed.name).toBe("demo-plugin");
    expect(parsed).toHaveProperty("devDependencies");
  });
});

describe("Manifest plugin scaffold public surface", () => {
  test("publicApi re-exports plugin scaffold helpers", () => {
    const publicApi = readFileSync(join(srcRoot, "app/publicApi.ts"), "utf8");
    expect(publicApi).toMatch(/validatePluginName/);
    expect(publicApi).toMatch(/createPluginJson|writePluginJson/);
  });

  test("plugin helper sources stay offline (no network clients)", () => {
    const manifestDir = join(srcRoot, "modules", "Manifest");
    expect(existsSync(manifestDir)).toBe(true);

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
