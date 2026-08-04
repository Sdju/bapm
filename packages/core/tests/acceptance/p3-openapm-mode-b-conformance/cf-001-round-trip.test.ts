/**
 * p3 / req-cf-001: idempotent parse→serialize→parse→serialize fixed point
 * on vendored manifest + lockfile seed fixtures (incl. unknown / x-* fields).
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
import {
  CF001_LOCKFILE_FIXTURES,
  CF001_MANIFEST_FIXTURES,
  fixturePath,
  normalizeTrailingNewline,
  readText,
} from "./helpers.ts";

describe("p3 Mode B — req-cf-001 round-trip (manifest)", () => {
  for (const rel of CF001_MANIFEST_FIXTURES) {
    test(`${rel}: stage-2 serialization is a fixed point`, () => {
      const path = fixturePath(rel);
      expect(existsSync(path), `missing fixture ${path}`).toBe(true);

      const raw = readText(path);
      const firstDoc = parseManifest(loadYamlDocument(raw, path)) as Record<string, unknown>;
      const canonical1 = serializeManifest(firstDoc);
      const secondDoc = parseManifest(loadYamlDocument(canonical1, path)) as Record<
        string,
        unknown
      >;
      const canonical2 = serializeManifest(secondDoc);

      expect(normalizeTrailingNewline(canonical2)).toBe(
        normalizeTrailingNewline(canonical1),
      );

      // Preserve top-level x-* / unknown extension keys across the loop.
      for (const key of Object.keys(firstDoc)) {
        if (key.startsWith("x-")) {
          expect(secondDoc[key], `lost extension key ${key}`).toEqual(firstDoc[key]);
        }
      }
    });
  }
});

describe("p3 Mode B — req-cf-001 round-trip (lockfile)", () => {
  for (const rel of CF001_LOCKFILE_FIXTURES) {
    test(`${rel}: stage-2 serialization is a fixed point`, () => {
      const path = fixturePath(rel);
      expect(existsSync(path), `missing fixture ${path}`).toBe(true);

      const raw = readText(path);
      const firstDoc = parseLockfile(raw) as Record<string, unknown>;
      const canonical1 = serializeLockfile(firstDoc);
      const secondDoc = parseLockfile(canonical1) as Record<string, unknown>;
      const canonical2 = serializeLockfile(secondDoc);

      expect(normalizeTrailingNewline(canonical2)).toBe(
        normalizeTrailingNewline(canonical1),
      );

      for (const key of Object.keys(firstDoc)) {
        if (key.startsWith("x-")) {
          expect(secondDoc[key], `lost extension key ${key}`).toEqual(firstDoc[key]);
        }
      }

      // Unknown future fields on deps (e.g. future_field_unknown_in_v01) preserved.
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
