/**
 * Unit: top-level manifest `env` validation (env-safe keys, string values).
 */
import { describe, expect, test } from "vite-plus/test";
import { ManifestError, parseManifestDocument } from "@b-apm/core";

function base(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { name: "env-field", version: "0.0.1", ...overrides };
}

describe("manifest top-level env", () => {
  test("accepts string→string env with env-safe keys", () => {
    const { document } = parseManifestDocument(
      base({ env: { FOO: "bar", _ok: "", PLUGIN_TOKEN: "x" } }),
    );
    expect(document.env).toEqual({ FOO: "bar", _ok: "", PLUGIN_TOKEN: "x" });
  });

  test("omitting env leaves it undefined", () => {
    const { document } = parseManifestDocument(base());
    expect(document.env).toBeUndefined();
  });

  test("rejects list env", () => {
    expect(() => parseManifestDocument(base({ env: ["FOO=bar"] }))).toThrow(ManifestError);
    expect(() => parseManifestDocument(base({ env: ["FOO=bar"] }))).toThrow(/env/i);
  });

  test("rejects non env-safe key", () => {
    expect(() => parseManifestDocument(base({ env: { "1BAD": "x" } }))).toThrow(/1BAD|env-safe/i);
  });

  test("rejects nested mapping value", () => {
    expect(() => parseManifestDocument(base({ env: { FOO: { nested: "x" } } }))).toThrow(
      /env\.FOO|string/i,
    );
  });
});
