/**
 * Unit: top-level manifest `scripts` validation (string→string command map).
 */
import { describe, expect, test } from "vite-plus/test";
import { ManifestError, parseManifestDocument } from "@b-apm/core";

function base(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { name: "scripts-field", version: "0.0.1", ...overrides };
}

describe("manifest top-level scripts", () => {
  test("accepts a string→string scripts map", () => {
    const { document } = parseManifestDocument(
      base({ scripts: { start: "echo hello", test: "node --test", greet: "echo {{name}}" } }),
    );
    expect(document.scripts).toEqual({
      start: "echo hello",
      test: "node --test",
      greet: "echo {{name}}",
    });
  });

  test("accepts an empty scripts map", () => {
    const { document } = parseManifestDocument(base({ scripts: {} }));
    expect(document.scripts).toEqual({});
  });

  test("omitting scripts leaves it undefined", () => {
    const { document } = parseManifestDocument(base());
    expect(document.scripts).toBeUndefined();
  });

  test("rejects list scripts", () => {
    expect(() => parseManifestDocument(base({ scripts: ["echo hello"] }))).toThrow(ManifestError);
    expect(() => parseManifestDocument(base({ scripts: ["echo hello"] }))).toThrow(/scripts/i);
  });

  test("rejects non-string command values", () => {
    expect(() => parseManifestDocument(base({ scripts: { start: 1 } }))).toThrow(
      /scripts\.start|string/i,
    );
  });
});
