/**
 * Unit: object-map + legacy target/targets parse; declaredTargetIds + map helper.
 */
import { describe, expect, test } from "vite-plus/test";
import {
  declaredTargetIds,
  declaredTargetIntegrationMap,
  ManifestError,
  parseManifestDocument,
  type BapmManifest,
} from "@bapm/core";

const CURSOR_PKG = "@bapm/integration-cursor";
const CLAUDE_PKG = "@bapm/integration-claude";

function parse(overrides: Record<string, unknown>): BapmManifest {
  return parseManifestDocument({
    name: "unit-root",
    version: "0.0.1",
    ...overrides,
  }).document;
}

function reject(overrides: Record<string, unknown>): ManifestError {
  try {
    parse(overrides);
  } catch (e) {
    expect(e).toBeInstanceOf(ManifestError);
    return e as ManifestError;
  }
  throw new Error("expected reject");
}

describe("target/targets object-map parse", () => {
  test("accepts targets map and retains values", () => {
    const doc = parse({
      targets: { cursor: CURSOR_PKG, claude: CLAUDE_PKG },
    });
    expect(doc.targets).toEqual({ cursor: CURSOR_PKG, claude: CLAUDE_PKG });
  });

  test("accepts target map (including multi-key)", () => {
    expect(parse({ target: { claude: CLAUDE_PKG } }).target).toEqual({
      claude: CLAUDE_PKG,
    });
    expect(
      parse({ target: { cursor: CURSOR_PKG, claude: CLAUDE_PKG } }).target,
    ).toEqual({ cursor: CURSOR_PKG, claude: CLAUDE_PKG });
  });

  test("legacy string and array still work", () => {
    expect(parse({ target: "cursor" }).target).toBe("cursor");
    expect(parse({ targets: ["cursor", "claude"] }).targets).toEqual([
      "cursor",
      "claude",
    ]);
  });

  test("rejects invalid key, empty value, empty map, both fields", () => {
    expect(reject({ targets: { "not-a-host": CURSOR_PKG } }).message).toMatch(
      /not-a-host|mf-005/i,
    );
    expect(reject({ targets: { cursor: "" } }).message).toMatch(/empty|non-empty/i);
    expect(reject({ targets: {} }).message).toMatch(/empty/i);
    expect(reject({ target: "cursor", targets: ["claude"] }).message).toMatch(
      /both.*target.*targets/i,
    );
    expect(
      reject({ target: { cursor: CURSOR_PKG }, targets: { claude: CLAUDE_PKG } })
        .message,
    ).toMatch(/both.*target.*targets/i);
  });

  test("rejects non-string map value and mixed array", () => {
    expect(reject({ targets: { cursor: 42 } }).message).toMatch(/string/i);
    expect(
      reject({ targets: ["cursor", { claude: CLAUDE_PKG }] }).message,
    ).toMatch(/targets|string|array/i);
  });
});

describe("declaredTargetIds + declaredTargetIntegrationMap", () => {
  test("ids from map keys; map helper retains bindings", () => {
    const doc = parse({
      targets: { cursor: CURSOR_PKG, claude: CLAUDE_PKG },
    });
    expect(declaredTargetIds(doc).sort()).toEqual(["claude", "cursor"]);
    expect(declaredTargetIntegrationMap(doc)).toEqual({
      cursor: CURSOR_PKG,
      claude: CLAUDE_PKG,
    });
  });

  test("legacy forms: ids work; map helper undefined", () => {
    expect(declaredTargetIds(parse({ target: "cursor" }))).toEqual(["cursor"]);
    expect(declaredTargetIntegrationMap(parse({ target: "cursor" }))).toBeUndefined();
    expect(
      declaredTargetIds(parse({ targets: ["cursor", "claude"] })).sort(),
    ).toEqual(["claude", "cursor"]);
    expect(
      declaredTargetIntegrationMap(parse({ targets: ["cursor", "claude"] })),
    ).toBeUndefined();
  });

  test("undefined when neither field set", () => {
    expect(declaredTargetIntegrationMap(parse({}))).toBeUndefined();
    expect(declaredTargetIds(parse({}))).toEqual([]);
  });
});
