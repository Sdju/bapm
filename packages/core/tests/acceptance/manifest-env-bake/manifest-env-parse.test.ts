/**
 * Acceptance (RED): top-level manifest `env` parse validation.
 * OpenSpec change: manifest-env-bake / manifest-yaml-validate
 */
import { describe, expect, test } from "vite-plus/test";
import { expectParseReject, parseOk } from "./helpers.ts";

describe("manifest-env-bake — top-level env parse", () => {
  test("env mapping round-trips on parse", () => {
    const doc = parseOk({ env: { FOO: "bar", PLUGIN_TOKEN: "from-yml" } });
    expect(doc.env).toMatchObject({ FOO: "bar", PLUGIN_TOKEN: "from-yml" });
    expect(doc.env?.FOO).toBe("bar");
  });

  test("absence of env remains valid", () => {
    const doc = parseOk({});
    expect(doc.env).toBeUndefined();
  });

  test("env as a list is rejected", () => {
    const message = expectParseReject({ env: ["FOO=bar"] });
    expect(message).toMatch(/env/i);
  });

  test("env key 1BAD is rejected (not env-safe)", () => {
    const message = expectParseReject({ env: { "1BAD": "x" } });
    expect(message).toMatch(/env|1BAD|key/i);
  });

  test("nested mapping env value is rejected", () => {
    const message = expectParseReject({ env: { FOO: { nested: "x" } } });
    expect(message).toMatch(/env|string|FOO/i);
  });

  test("empty string env value is accepted (shape ok; bake still requires non-empty)", () => {
    const doc = parseOk({ env: { EMPTY_OK: "" } });
    expect(doc.env?.EMPTY_OK).toBe("");
  });
});
