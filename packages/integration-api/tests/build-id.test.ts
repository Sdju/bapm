/**
 * Deterministic compiled-output Build ID: stable across runs, changes with
 * content, idempotent, and rejected after manual edits.
 */
import { describe, expect, test } from "vite-plus/test";
import {
  BUILD_ID_PLACEHOLDER,
  applyBuildId,
  computeBuildId,
  hasBuildIdLine,
  hasValidBuildId,
  stabilizeBuildId,
} from "../src/index.ts";

const BUILD_ID_LINE = /^<!-- Build ID: ([0-9a-f]{12}) -->$/;

describe("compiled Build ID", () => {
  test("appends exactly one canonical Build ID line and hashes the body", () => {
    const first = applyBuildId("# AGENTS.md\n\nBody.\n");
    const line = first.trimEnd().split("\n").at(-1) ?? "";
    expect(line).toMatch(BUILD_ID_LINE);
    expect(first.match(/<!-- Build ID: /g)).toHaveLength(1);
    expect(hasBuildIdLine(first)).toBe(true);
    expect(hasValidBuildId(first)).toBe(true);
  });

  test("identical content yields an identical id across runs", () => {
    const body = "# CLAUDE.md\n\nSame input.\n";
    const first = applyBuildId(body);
    const second = applyBuildId(body);
    expect(second).toBe(first);
    expect(computeBuildId(first)).toBe(computeBuildId(second));
  });

  test("changed content changes the id", () => {
    const first = applyBuildId("# AGENTS.md\n\nBefore.\n");
    const second = applyBuildId("# AGENTS.md\n\nAfter.\n");
    expect(first).not.toBe(second);
  });

  test("line-ending normalization keeps the id stable", () => {
    const lf = applyBuildId("# AGENTS.md\n\nBody.\n");
    const crlf = applyBuildId("# AGENTS.md\r\n\r\nBody.\r\n");
    expect(crlf).toBe(lf);
  });

  test("applying to generated content is idempotent", () => {
    const once = applyBuildId("# AGENTS.md\n\nBody.\n");
    expect(applyBuildId(once)).toBe(once);
  });

  test("placeholder stabilization emits the same line", () => {
    const stabilized = stabilizeBuildId(`# AGENTS.md\n${BUILD_ID_PLACEHOLDER}\n\nBody.\n`);
    expect(stabilized.match(/<!-- Build ID: /g)).toHaveLength(1);
    expect(stabilized).not.toContain(BUILD_ID_PLACEHOLDER);
    expect(hasValidBuildId(stabilized)).toBe(true);
  });

  test("edited generated content is invalid and hand-authored content has no line", () => {
    const generated = applyBuildId("# AGENTS.md\n\nBody.\n");
    const edited = generated.replace("Body.", "Edited by hand.");
    expect(hasBuildIdLine(edited)).toBe(true);
    expect(hasValidBuildId(edited)).toBe(false);
    expect(hasBuildIdLine("# AGENTS.md\n\nHand authored.\n")).toBe(false);
    expect(hasValidBuildId("# AGENTS.md\n\nHand authored.\n")).toBe(false);
  });
});
