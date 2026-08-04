import { expect, test } from "vite-plus/test";
import {
  APM_MANIFEST_FILE,
  BAPM_MANIFEST_FILE,
  discoverManifestPath,
  getVersion,
  loadManifest,
  parseManifest,
  parseManifestDocument,
} from "../src/index.ts";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("getVersion", () => {
  expect(getVersion()).toBe("0.0.0");
});

test("manifest filename constants", () => {
  expect(APM_MANIFEST_FILE).toBe("apm.yml");
  expect(BAPM_MANIFEST_FILE).toBe("bapm.yml");
});

test("parseManifest accepts a minimal manifest", () => {
  const manifest = parseManifest({ name: "demo", version: "1.0.0" });
  expect(manifest.name).toBe("demo");
  expect(manifest.version).toBe("1.0.0");
});

test("parseManifest rejects invalid input", () => {
  expect(() => parseManifest(null)).toThrow(/object|mapping/i);
  expect(() => parseManifest({})).toThrow(/name/);
});

test("parseManifestDocument retains unknown keys and may warn on non-semver", () => {
  const { document, warnings } = parseManifestDocument({
    name: "demo",
    version: "not-semver",
    future_flag: true,
  });
  expect(document.future_flag).toBe(true);
  expect(warnings.some((w) => /semver/i.test(w.message))).toBe(true);
});

test("parseManifest accepts git+path, parent+path, alias, registries.default", () => {
  const manifest = parseManifest({
    name: "parity",
    version: "1.0.0",
    registries: {
      internal: { url: "https://registry.internal.example.com/apm" },
      default: "internal",
    },
    dependencies: {
      apm: [
        { git: "https://github.com/o/r.git", path: "skills/x", alias: "x" },
        { git: "parent", path: "packages/y" },
      ],
    },
  });
  expect(manifest.registries?.default).toBe("internal");
  const apm = manifest.dependencies?.apm as Array<Record<string, unknown>>;
  expect(apm[0].path).toBe("skills/x");
  expect(apm[0].alias).toBe("x");
  expect(apm[1].git).toBe("parent");
});

test("parseManifest rejects bare git parent and bad registries.default", () => {
  expect(() =>
    parseManifest({
      name: "bad",
      version: "1.0.0",
      dependencies: { apm: [{ git: "parent" }] },
    }),
  ).toThrow(/parent|path/i);
  expect(() =>
    parseManifest({
      name: "bad",
      version: "1.0.0",
      registries: {
        contoso: { url: "https://registry.contoso.example.com" },
        default: "missing",
      },
    }),
  ).toThrow(/default|unconfigured|registry/i);
});

test("discoverManifestPath + loadManifest round-trip on temp bapm.yml", () => {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-core-unit-"));
  try {
    writeFileSync(join(cwd, "bapm.yml"), 'name: unit\nversion: "1.2.3"\n', "utf8");
    const found = discoverManifestPath({ cwd });
    expect(found.filename).toBe("bapm.yml");
    const loaded = loadManifest({ cwd });
    expect(loaded.document.name).toBe("unit");
    expect(loaded.sourceFilename).toBe("bapm.yml");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
