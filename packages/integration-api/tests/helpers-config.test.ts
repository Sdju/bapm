import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { readJsonDocument, writeJsonDocument } from "../src/index.ts";

describe("readJsonDocument", () => {
  test("missing file returns an empty object", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-json-"));
    expect(readJsonDocument({ path: join(cwd, "missing.json") })).toEqual({});
  });

  test("tolerant mode returns {} for malformed JSON", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-json-"));
    const path = join(cwd, "broken.json");
    writeFileSync(path, "{ nope", "utf8");
    expect(readJsonDocument({ path })).toEqual({});
  });

  test("strict mode reports malformed JSON with the label", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-json-"));
    const path = join(cwd, "broken.json");
    writeFileSync(path, "{ nope", "utf8");
    expect(() =>
      readJsonDocument({ path, strict: true, label: "Test config at broken.json" }),
    ).toThrow(/Test config at broken\.json is malformed JSON/);
  });

  test("strict mode rejects non-object documents", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-json-"));
    const path = join(cwd, "array.json");
    writeFileSync(path, "[]", "utf8");
    expect(() => readJsonDocument({ path, strict: true, label: "Array config" })).toThrow(
      /expected a JSON object/,
    );
  });

  test("jsonc mode strips comments and trailing commas", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-json-"));
    const path = join(cwd, "config.jsonc");
    writeFileSync(path, `{\n  // comment\n  "a": 1,\n}\n`, "utf8");
    expect(readJsonDocument({ path, jsonc: true })).toEqual({ a: 1 });
  });
});

describe("writeJsonDocument", () => {
  test("creates parents and writes two-space JSON with a trailing newline", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-json-"));
    const path = join(cwd, "nested", "config.json");
    writeJsonDocument(path, { a: 1, b: { c: true } });
    expect(readFileSync(path, "utf8")).toBe(`{\n  "a": 1,\n  "b": {\n    "c": true\n  }\n}\n`);
  });
});
