/**
 * Unit: Manifest parse accept/reject for bapm `local` source.
 */
import { describe, expect, test } from "vite-plus/test";
import { ManifestError, parseManifestDocument } from "@b-apm/core";

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
  test("accepts string list item 'local' as { local: true }", () => {
    const doc = parseManifestDocument({
      name: "u",
      version: "0.0.1",
      dependencies: { apm: ["local"] },
    }).document;
    expect(doc.dependencies!.apm![0]).toEqual({ local: true });
  });

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
    expect(rejectApm({ local: "./a", git: "https://github.com/example/repo.git" })).toMatch(
      /local|git|source/i,
    );
  });

  test("rejects object with no source key", () => {
    expect(rejectApm({ alias: "only-meta" })).toMatch(
      /source|git|id|path|registry|marketplace|local/i,
    );
  });

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
