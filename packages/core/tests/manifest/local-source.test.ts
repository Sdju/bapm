/**
 * Unit: Manifest parse accept/reject for bapm `local` source.
 */
import { describe, expect, test } from "vite-plus/test";
import { ManifestError, parseManifestDocument } from "@bapm/core";

function parseApm(dep: Record<string, unknown>) {
  return parseManifestDocument({
    name: "u",
    version: "0.0.1",
    dependencies: { apm: [dep] },
  }).document.dependencies!.apm![0] as Record<string, unknown>;
}

function rejectApm(dep: Record<string, unknown>): string {
  try {
    parseApm(dep);
  } catch (error) {
    expect(error).toBeInstanceOf(ManifestError);
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("expected reject");
}

describe("Manifest local source parse", () => {
  test("accepts true / null / empty / custom string", () => {
    expect(parseApm({ local: true }).local).toBe(true);
    expect(parseApm({ local: null }).local).toBeNull();
    expect(parseApm({ local: "" }).local).toBe("");
    expect(parseApm({ local: "./alt" }).local).toBe("./alt");
  });

  test("accepts alias meta with local", () => {
    const entry = parseApm({ local: true, alias: "wip" });
    expect(entry.local).toBe(true);
    expect(entry.alias).toBe("wip");
  });

  test("path-only still accepted", () => {
    expect(parseApm({ path: "./pkgs/a" }).path).toBe("./pkgs/a");
  });

  test("rejects false, nested, and dual sources", () => {
    expect(rejectApm({ local: false })).toMatch(/local/i);
    expect(rejectApm({ local: { nested: true } })).toMatch(/local/i);
    expect(rejectApm({ local: true, path: "./a" })).toMatch(/local|path|source/i);
    expect(
      rejectApm({ local: "./a", git: "https://github.com/example/repo.git" }),
    ).toMatch(/local|git|source/i);
  });
});
