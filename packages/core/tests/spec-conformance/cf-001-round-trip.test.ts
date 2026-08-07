/**
 * Mode B / req-cf-001 — idempotent parse→serialize→parse→serialize fixed point
 * on vendored OpenAPM seed manifest + lockfile fixtures (incl. x-* / unknown fields).
 */
import { expect, test, describe } from "vite-plus/test";
import { existsSync } from "node:fs";
import {
  loadYamlDocument,
  parseLockfile,
  parseManifest,
  serializeLockfile,
  serializeManifest,
} from "@bapm/core";
import { fixturePath, normalizeTrailingNewline, readFixture } from "./helpers.ts";

const MANIFEST_FIXTURES = [
  "manifest/valid-minimal.yml",
  "manifest/x-extension-roundtrip.yml",
] as const;

const LOCKFILE_FIXTURES = [
  "lockfile/round-trip-unknown-fields.yml",
  "lockfile/v2-with-registry.yml",
] as const;

describe("Mode B req-cf-001 — manifest round-trip", () => {
  for (const rel of MANIFEST_FIXTURES) {
    test(`${rel}: stage-2 serialization is a fixed point`, () => {
      const path = fixturePath(rel);
      expect(existsSync(path), `missing fixture ${path}`).toBe(true);

      const raw = readFixture(rel);
      const firstDoc = parseManifest(loadYamlDocument(raw, path)) as Record<string, unknown>;
      const canonical1 = serializeManifest(firstDoc);
      const secondDoc = parseManifest(loadYamlDocument(canonical1, path)) as Record<
        string,
        unknown
      >;
      const canonical2 = serializeManifest(secondDoc);

      expect(normalizeTrailingNewline(canonical2)).toBe(normalizeTrailingNewline(canonical1));

      for (const key of Object.keys(firstDoc)) {
        if (key.startsWith("x-")) {
          expect(secondDoc[key], `lost extension key ${key}`).toEqual(firstDoc[key]);
        }
      }
    });
  }
});

describe("Mode B req-cf-001 — lockfile round-trip", () => {
  for (const rel of LOCKFILE_FIXTURES) {
    test(`${rel}: stage-2 serialization is a fixed point`, () => {
      const path = fixturePath(rel);
      expect(existsSync(path), `missing fixture ${path}`).toBe(true);

      const raw = readFixture(rel);
      const firstDoc = parseLockfile(raw) as Record<string, unknown>;
      const canonical1 = serializeLockfile(firstDoc);
      const secondDoc = parseLockfile(canonical1) as Record<string, unknown>;
      const canonical2 = serializeLockfile(secondDoc);

      expect(normalizeTrailingNewline(canonical2)).toBe(normalizeTrailingNewline(canonical1));

      for (const key of Object.keys(firstDoc)) {
        if (key.startsWith("x-")) {
          expect(secondDoc[key], `lost extension key ${key}`).toEqual(firstDoc[key]);
        }
      }

      const deps1 = firstDoc.dependencies;
      const deps2 = secondDoc.dependencies;
      if (Array.isArray(deps1) && Array.isArray(deps2) && deps1[0] && deps2[0]) {
        const d1 = deps1[0] as Record<string, unknown>;
        const d2 = deps2[0] as Record<string, unknown>;
        for (const key of Object.keys(d1)) {
          if (key.startsWith("x-") || key.startsWith("future_")) {
            expect(d2[key], `lost dep extension ${key}`).toEqual(d1[key]);
          }
        }
      }
    });
  }
});
