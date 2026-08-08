/**
 * Acceptance (RED): declaredTargetIds from map keys + integration-map helper.
 * OpenSpec change: manifest-target-integration-map
 * Spec: install-pipeline (declared ids) + design §5 helper
 */
import { describe, expect, test } from "vite-plus/test";
import type { BapmManifest } from "@bapm/core";
import {
  getDeclaredTargetIds,
  getDeclaredTargetIntegrationMap,
  parseOk,
} from "./helpers.ts";

const CURSOR_PKG = "@bapm/integration-cursor";
const CLAUDE_PKG = "@bapm/integration-claude";

describe("manifest-target-integration-map declared ids", () => {
  test("declaredTargetIds returns object-map keys for targets", () => {
    const doc = parseOk({
      targets: {
        cursor: CURSOR_PKG,
        claude: CLAUDE_PKG,
      },
    });
    const ids = getDeclaredTargetIds()(doc);
    expect(ids.sort()).toEqual(["claude", "cursor"]);
  });

  test("declaredTargetIds returns object-map keys for singular target", () => {
    const doc = parseOk({
      target: { claude: CLAUDE_PKG },
    });
    const ids = getDeclaredTargetIds()(doc);
    expect(ids).toEqual(["claude"]);
  });

  test("declaredTargetIds still returns legacy string / array", () => {
    expect(getDeclaredTargetIds()(parseOk({ target: "cursor" }))).toEqual(["cursor"]);
    expect(getDeclaredTargetIds()(parseOk({ targets: ["cursor", "claude"] })).sort()).toEqual([
      "claude",
      "cursor",
    ]);
  });
});

describe("manifest-target-integration-map declaredTargetIntegrationMap helper", () => {
  test("returns the retained map for object-map targets", () => {
    const doc = parseOk({
      targets: {
        cursor: CURSOR_PKG,
        claude: CLAUDE_PKG,
      },
    });
    const map = getDeclaredTargetIntegrationMap()(doc);
    expect(map).toEqual({
      cursor: CURSOR_PKG,
      claude: CLAUDE_PKG,
    });
  });

  test("returns the retained map for object-map target", () => {
    const doc = parseOk({
      target: { claude: CLAUDE_PKG },
    });
    expect(getDeclaredTargetIntegrationMap()(doc)).toEqual({ claude: CLAUDE_PKG });
  });

  test("returns undefined for legacy string / array forms", () => {
    expect(getDeclaredTargetIntegrationMap()(parseOk({ target: "cursor" }))).toBeUndefined();
    expect(
      getDeclaredTargetIntegrationMap()(parseOk({ targets: ["cursor", "claude"] })),
    ).toBeUndefined();
  });

  test("returns undefined when neither target nor targets is set", () => {
    const doc = parseOk({}) as BapmManifest;
    expect(getDeclaredTargetIntegrationMap()(doc)).toBeUndefined();
  });
});
