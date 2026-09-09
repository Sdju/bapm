/**
 * Unit: object-form skills/targets subset parse + serialize id: round-trip.
 */
import { describe, expect, test } from "vite-plus/test";
import {
  loadYamlDocument,
  parseManifest,
  serializeManifest,
  mergeApmDependencyUpdate,
} from "@b-apm/core";

describe("dep subset parse (unit)", () => {
  test("registry id skills/targets accepted and deduped", () => {
    const doc = parseManifest({
      name: "u",
      version: "0.0.1",
      dependencies: {
        apm: [{ id: "acme/toolkit", version: "1.0.0", skills: ["lint", "deploy", "lint"] }],
      },
    });
    const entry = doc.dependencies!.apm![0] as { skills?: string[] };
    expect(entry.skills).toEqual(["deploy", "lint"]);
  });

  test("git object-form rejects empty skills", () => {
    expect(() =>
      parseManifest({
        name: "u",
        version: "0.0.1",
        dependencies: { apm: [{ git: "https://github.com/acme/t.git", skills: [] }] },
      }),
    ).toThrow(/at least one skill/i);
  });

  test("serializeManifest keeps id: not git:", () => {
    const doc = parseManifest({
      name: "u",
      version: "0.0.1",
      dependencies: {
        apm: [{ id: "acme/toolkit", version: "1.0.0", skills: ["alpha"] }],
      },
    });
    const yaml = serializeManifest(doc);
    expect(yaml).toMatch(/id:\s*acme\/toolkit/);
    expect(yaml).not.toMatch(/(^|\n)\s*git:/);
    const again = parseManifest(loadYamlDocument(yaml));
    expect((again.dependencies!.apm![0] as { id?: string }).id).toBe("acme/toolkit");
  });

  test("mergeApmDependencyUpdate refuses registry→git", () => {
    const doc = parseManifest({
      name: "u",
      version: "0.0.1",
      dependencies: { apm: [{ id: "acme/demo-pkg", version: "1.0.0" }] },
    });
    expect(() =>
      mergeApmDependencyUpdate(doc as unknown as Record<string, unknown>, {
        git: "acme/demo-pkg",
        ref: "1.0.0",
        skills: ["x"],
      }),
    ).toThrow(/acme\/demo-pkg/);
  });
});
