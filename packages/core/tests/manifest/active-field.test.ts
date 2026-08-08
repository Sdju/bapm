/**
 * Unit: manifest `active` parse/validate + serialize + dual-read + declared ids.
 * Promoted coverage from manifest-active-targets acceptance.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  ManifestError,
  declaredTargetIds,
  loadManifest,
  parseManifest,
  parseManifestDocument,
  serializeManifest,
  writeProducerManifest,
} from "@bapm/core";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

function base(overrides: Record<string, unknown> = {}) {
  return { name: "active-unit", version: "0.0.1", ...overrides };
}

function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

describe("manifest active field", () => {
  test("accepts non-empty mf-005 list", () => {
    const doc = parseManifest(base({ active: ["cursor", "x-acme-editor"] }));
    expect(doc.active).toEqual(["cursor", "x-acme-editor"]);
  });

  test("accepts sole active entry", () => {
    const doc = parseManifest(base({ active: ["cursor"] }));
    expect(doc.active).toEqual(["cursor"]);
  });

  test("rejects empty active array", () => {
    expect(() => parseManifest(base({ active: [] }))).toThrow(ManifestError);
    try {
      parseManifest(base({ active: [] }));
    } catch (e) {
      const err = e as ManifestError;
      expect(err.message).toMatch(/active/i);
      expect(err.message).toMatch(/empty|non-empty/i);
      expect(err.path).toBe("active");
    }
  });

  test("rejects scalar active", () => {
    expect(() => parseManifest(base({ active: "cursor" }))).toThrow(/active/i);
  });

  test("rejects object-map active", () => {
    expect(() => parseManifest(base({ active: { cursor: true } }))).toThrow(/active/i);
  });

  test("rejects empty string element", () => {
    expect(() => parseManifest(base({ active: ["cursor", ""] }))).toThrow(
      /active|empty|non-empty/i,
    );
  });

  test("rejects invalid token with named diagnostic", () => {
    try {
      parseManifest(base({ active: ["not-a-host"] }));
      throw new Error("expected reject");
    } catch (e) {
      const err = e as ManifestError;
      expect(err.message).toMatch(/not-a-host/);
      expect(err.message).toMatch(/mf-005/);
      expect(err.details?.token).toBe("not-a-host");
    }
  });

  test("serialize / producer write preserves active", () => {
    const doc = parseManifest(base({ active: ["cursor"] }));
    const yaml = serializeManifest(doc);
    expect(yaml).toMatch(/active:/);
    expect(yaml).toMatch(/cursor/);

    const cwd = mkdtempSync(join(tmpdir(), "bapm-active-write-"));
    try {
      const { path } = writeProducerManifest(doc, { cwd, path: join(cwd, "bapm.yml") });
      const round = parseManifestDocument(base({ active: ["cursor"] }));
      expect(round.document.active).toEqual(["cursor"]);
      expect(readFileSync(path, "utf8")).toMatch(/active:[\s\S]*cursor/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("manifest active — dual-read apm.yml", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("apm.yml with valid active loads under same rules as bapm.yml", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-active-apm-"));
    writeText(
      join(cwd, "apm.yml"),
      ["name: dual-active", "version: 0.0.1", "active:", "  - cursor", "dependencies:", "  apm: []", ""].join(
        "\n",
      ),
    );

    const loaded = loadManifest({ cwd });
    expect(loaded.sourceFilename).toMatch(/apm\.yml/);
    expect(loaded.document.active).toEqual(["cursor"]);
  });

  test("apm.yml with empty active rejected", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-active-apm-empty-"));
    writeText(
      join(cwd, "apm.yml"),
      ["name: dual-empty-active", "version: 0.0.1", "active: []", "dependencies:", "  apm: []", ""].join(
        "\n",
      ),
    );

    expect(() => loadManifest({ cwd: cwd! })).toThrow(/active/i);
  });
});

describe("manifest active vs target/targets roles", () => {
  test("declaredTargetIds come from targets only, not from active", () => {
    const doc = parseManifest(
      base({
        targets: ["cursor"],
        active: ["cursor", "x-acme-editor"],
      }),
    );

    const ids = declaredTargetIds(doc);
    expect(ids).toEqual(["cursor"]);
    expect(ids).not.toContain("x-acme-editor");
  });

  test("active alone does not invent declared preference ids", () => {
    const doc = parseManifest(base({ active: ["cursor"] }));
    expect(declaredTargetIds(doc)).toEqual([]);
  });
});
