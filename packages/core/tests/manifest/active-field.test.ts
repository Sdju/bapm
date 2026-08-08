/**
 * Unit: manifest `active` parse/validate + serialize round-trip.
 * OpenSpec change: manifest-active-targets
 */
import { describe, expect, test } from "vite-plus/test";
import {
  ManifestError,
  parseManifest,
  parseManifestDocument,
  serializeManifest,
  writeProducerManifest,
} from "@bapm/core";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function base(overrides: Record<string, unknown> = {}) {
  return { name: "active-unit", version: "0.0.1", ...overrides };
}

describe("manifest active field", () => {
  test("accepts non-empty mf-005 list", () => {
    const doc = parseManifest(base({ active: ["cursor", "x-acme-editor"] }));
    expect(doc.active).toEqual(["cursor", "x-acme-editor"]);
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
