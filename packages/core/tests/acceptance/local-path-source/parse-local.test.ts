/**
 * Acceptance (RED): parse/validate bapm-only `local` source discriminator.
 * OpenSpec change: local-path-source
 */
import { describe, expect, test } from "vite-plus/test";
import { expectParseReject, parseApmObject, parseManifestDocument } from "./helpers.ts";

describe("local-path-source parse — accept shapes", () => {
  test("accepts local: true (default root form)", () => {
    const entry = parseApmObject({ local: true });
    expect(entry.local).toBe(true);
    expect(entry.path).toBeUndefined();
  });

  test("accepts local: null / empty string as default form", () => {
    const nullEntry = parseApmObject({ local: null });
    expect(nullEntry.local === null || nullEntry.local === "").toBe(true);

    const emptyEntry = parseApmObject({ local: "" });
    expect(emptyEntry.local === "" || emptyEntry.local == null).toBe(true);
  });

  test("accepts local: custom non-empty string path", () => {
    const entry = parseApmObject({ local: "./alt-local" });
    expect(entry.local).toBe("./alt-local");
  });

  test("accepts local with alias meta", () => {
    const entry = parseApmObject({ local: true, alias: "wip-skill" });
    expect(entry.local).toBe(true);
    expect(entry.alias).toBe("wip-skill");
  });

  test("accepts path-only object unchanged (OpenAPM path regression)", () => {
    const entry = parseApmObject({ path: "./pkgs/a" });
    expect(entry.path).toBe("./pkgs/a");
    expect(entry.local).toBeUndefined();
  });
});

describe("local-path-source parse — reject shapes", () => {
  test("rejects local: false", () => {
    const message = expectParseReject({ local: false });
    expect(message).toMatch(/local/i);
  });

  test("rejects non-scalar unsupported local value", () => {
    const message = expectParseReject({ local: { nested: true } });
    expect(message).toMatch(/local/i);
  });

  test("rejects local combined with path as second source kind", () => {
    const message = expectParseReject({ local: true, path: "./pkgs/a" });
    expect(message).toMatch(/local|path|source/i);
  });

  test("rejects local combined with git", () => {
    const message = expectParseReject({
      local: "./alt",
      git: "https://github.com/example/repo.git",
    });
    expect(message).toMatch(/local|git|source/i);
  });

  test("still rejects object with no source key", () => {
    const message = expectParseReject({ alias: "only-meta" });
    expect(message).toMatch(/source|git|id|path|registry|marketplace|local/i);
  });
});

describe("local-path-source parse — list placement", () => {
  test("accepts local under dependencies.apm and devDependencies.apm", () => {
    const { document } = parseManifestDocument({
      name: "both-lists",
      version: "0.0.1",
      dependencies: { apm: [{ local: true }] },
      devDependencies: { apm: [{ local: "./dev-local" }] },
    });
    const prod = document.dependencies?.apm?.[0] as Record<string, unknown>;
    const dev = document.devDependencies?.apm?.[0] as Record<string, unknown>;
    expect(prod.local).toBe(true);
    expect(dev.local).toBe("./dev-local");
  });
});
