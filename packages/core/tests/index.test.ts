import { expect, test } from "vite-plus/test";
import {
  APM_LOCK_FILE,
  APM_MANIFEST_FILE,
  BAPM_LOCK_FILE,
  BAPM_MANIFEST_FILE,
  discoverLockfilePath,
  discoverManifestPath,
  getVersion,
  isSemanticallyEquivalent,
  loadLockfile,
  loadManifest,
  parseLockfile,
  parseManifest,
  parseManifestDocument,
  serializeLockfile,
  writeLockfile,
} from "../src/index.ts";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

test("lockfile filename constants", () => {
  expect(APM_LOCK_FILE).toBe("apm.lock.yaml");
  expect(BAPM_LOCK_FILE).toBe("bapm.lock.yaml");
});

test("parseLockfile accepts minimal lock and serialize emits version", () => {
  const doc = parseLockfile('lockfile_version: "1"\ndependencies: []\n');
  expect(doc.lockfile_version).toBe("1");
  expect(doc.dependencies).toEqual([]);
  expect(serializeLockfile(doc)).toMatch(/lockfile_version:\s*["']?1["']?/);
});

test("isSemanticallyEquivalent ignores generated_at / apm_version", () => {
  const a = parseLockfile(`lockfile_version: "1"
generated_at: "2020-01-01T00:00:00Z"
apm_version: "0.1.0"
dependencies: []
`);
  const b = parseLockfile(`lockfile_version: "1"
generated_at: "2099-01-01T00:00:00Z"
apm_version: "9.9.9"
dependencies: []
`);
  expect(isSemanticallyEquivalent(a, b)).toBe(true);
});

test("discoverLockfilePath + writeLockfile fresh create bapm.lock.yaml", () => {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-core-lock-"));
  try {
    writeFileSync(join(cwd, "apm.lock.yaml"), 'lockfile_version: "1"\ndependencies: []\n', "utf8");
    const found = discoverLockfilePath({ cwd });
    expect(found.filename).toBe("apm.lock.yaml");
    const loaded = loadLockfile({ cwd });
    expect(loaded.document.lockfile_version).toBe("1");

    const fresh = mkdtempSync(join(tmpdir(), "bapm-core-lock-fresh-"));
    try {
      writeLockfile(loaded.document, { cwd: fresh });
      expect(existsSync(join(fresh, "bapm.lock.yaml"))).toBe(true);
      expect(existsSync(join(fresh, "apm.lock.yaml"))).toBe(false);
    } finally {
      rmSync(fresh, { recursive: true, force: true });
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
