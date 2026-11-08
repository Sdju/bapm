/**
 * `targets` scalar / CSV and `target` CSV / list sugar (APM 0.35 parity).
 * Canonical arrays survive serialize/parse round-trip.
 */
import { describe, expect, test } from "vite-plus/test";
import { parse as parseYaml } from "yaml";
import {
  declaredTargetIds,
  ManifestError,
  parseManifestDocument,
  serializeManifest,
  type BapmManifest,
} from "@b-apm/core";

function parse(overrides: Record<string, unknown>): BapmManifest {
  return parseManifestDocument({ name: "targets-root", version: "1.0.0", ...overrides }).document;
}

function reject(overrides: Record<string, unknown>): ManifestError {
  try {
    parse(overrides);
  } catch (error) {
    expect(error).toBeInstanceOf(ManifestError);
    return error as ManifestError;
  }
  throw new Error("expected reject");
}

describe("targets scalar / CSV forms", () => {
  test("targets: cursor scalar normalizes to a one-element array", () => {
    expect(parse({ targets: "cursor" }).targets).toEqual(["cursor"]);
  });

  test("targets CSV string normalizes to an array and trims tokens", () => {
    expect(parse({ targets: " cursor , claude " }).targets).toEqual(["cursor", "claude"]);
  });

  test("target CSV string normalizes to an array", () => {
    expect(parse({ target: "claude,copilot" }).target).toEqual(["claude", "copilot"]);
  });

  test("target list sugar (single and multi) accepted", () => {
    expect(parse({ target: ["cursor"] }).target).toBe("cursor");
    expect(parse({ target: ["cursor", "claude"] }).target).toEqual(["cursor", "claude"]);
  });

  test("aliases are normalized inside CSV and scalar targets", () => {
    expect(parse({ targets: "vscode,agents,cursor" }).targets).toEqual(["copilot", "cursor"]);
    expect(parse({ target: "vscode,agents" }).target).toBe("copilot");
  });

  test("declaredTargetIds sees target arrays", () => {
    expect(declaredTargetIds(parse({ target: "cursor,claude" }))).toEqual(["cursor", "claude"]);
  });

  test("mutual exclusion still applies to scalar/CSV forms", () => {
    expect(reject({ target: "cursor", targets: "claude" }).message).toMatch(/both.*target/i);
    expect(reject({ target: "cursor,claude", targets: ["codex"] }).message).toMatch(
      /both.*target/i,
    );
  });

  test("invalid CSV token is rejected and named", () => {
    const err = reject({ targets: "cursor,not-a-host" });
    expect(err.message).toMatch(/not-a-host/);
    expect(err.message).toMatch(/mf-005|target|token|invalid/i);
  });

  test("empty CSV is rejected", () => {
    expect(reject({ targets: " , " }).message).toMatch(/non-empty|target/i);
    expect(reject({ target: "," }).message).toMatch(/non-empty|target/i);
  });

  test("scalar/CSV round-trips through serialize/parse", () => {
    for (const input of [
      { targets: "cursor,claude" },
      { target: "claude,copilot" },
      { target: "cursor" },
    ]) {
      const first = parse(input);
      const reparsed = parseManifestDocument(parseYaml(serializeManifest(first))).document;
      expect(reparsed.targets ?? reparsed.target).toEqual(first.targets ?? first.target);
    }
  });
});
