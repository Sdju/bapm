/**
 * Unit: object-map + legacy target/targets parse; declaredTargetIds + map helper.
 * Promoted coverage from manifest-target-integration-map acceptance.
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

  test("accepts vendor mf-005 key and opaque @version package text", () => {
    expect(
      parse({ targets: { "x-acme-editor": "@acme/integration-editor" } }).targets,
    ).toEqual({ "x-acme-editor": "@acme/integration-editor" });
    expect(
      parse({ targets: { cursor: "@bapm/integration-cursor@1.2.3" } }).targets,
    ).toEqual({ cursor: "@bapm/integration-cursor@1.2.3" });
  });

  test("legacy string and array still work", () => {
    expect(parse({ target: "cursor" }).target).toBe("cursor");
    expect(parse({ targets: ["cursor", "claude"] }).targets).toEqual([
      "cursor",
      "claude",
    ]);
  });

  test("rejects invalid key with named diagnostic", () => {
    const err = reject({ targets: { "not-a-host": CURSOR_PKG } });
    expect(err.message).toMatch(/not-a-host/);
    expect(err.message).toMatch(/mf-005|target|token|invalid/i);
    const named =
      err.path?.includes("not-a-host") ||
      err.details?.token === "not-a-host" ||
      /targets\.not-a-host|targets\[["']?not-a-host/.test(String(err.path ?? ""));
    expect(named || /not-a-host/.test(err.message)).toBe(true);
  });

  test("rejects empty / whitespace / non-string values and empty maps", () => {
    expect(reject({ targets: { cursor: "" } }).message).toMatch(/empty|non-empty/i);
    expect(reject({ target: { cursor: "   " } }).message).toMatch(
      /empty|non-empty|value|target/i,
    );
    expect(reject({ targets: { cursor: 42 } }).message).toMatch(/string/i);
    expect(reject({ targets: {} }).message).toMatch(/empty/i);
    expect(reject({ target: {} }).message).toMatch(/empty|target/i);
    expect(
      reject({ targets: ["cursor", { claude: CLAUDE_PKG }] }).message,
    ).toMatch(/targets|string|array|object|mapping/i);
  });

  test("rejects mutual exclusion across legacy and object-map forms", () => {
    expect(reject({ target: "cursor", targets: ["claude"] }).message).toMatch(
      /both.*target.*targets|target.*and.*targets/i,
    );
    expect(
      reject({ target: { cursor: CURSOR_PKG }, targets: { claude: CLAUDE_PKG } })
        .message,
    ).toMatch(/both.*target.*targets|target.*and.*targets/i);
    expect(
      reject({ target: "cursor", targets: { claude: CLAUDE_PKG } }).message,
    ).toMatch(/both.*target.*targets|target.*and.*targets/i);
    expect(
      reject({ target: { cursor: CURSOR_PKG }, targets: ["claude"] }).message,
    ).toMatch(/both.*target.*targets|target.*and.*targets/i);
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

  test("singular target object map: ids and retained helper map", () => {
    const doc = parse({ target: { claude: CLAUDE_PKG } });
    expect(declaredTargetIds(doc)).toEqual(["claude"]);
    expect(declaredTargetIntegrationMap(doc)).toEqual({ claude: CLAUDE_PKG });
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
