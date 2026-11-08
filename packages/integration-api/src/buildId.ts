/**
 * Deterministic Build ID stabilization for compiled Markdown outputs.
 *
 * Compiled outputs are rendered without volatile fields. Before persisting,
 * `compileMarkdownReport` calls `applyBuildId` so every generated file carries
 * exactly one `<!-- Build ID: <12 hex> -->` line. The id is a truncated SHA-256
 * of the normalized document body with every Build ID line removed, so it is
 * not self-referential and stays stable across rebuilds with identical input.
 *
 * The id detects drift; it is not a provenance or security attestation.
 */

import { createHash } from "node:crypto";

/** Sentinel inserted by formatters; replaced before any durable write. */
export const BUILD_ID_PLACEHOLDER = "<!-- Build ID: __BUILD_ID__ -->";

/** Canonical, single-line Build ID marker. */
export const BUILD_ID_LINE_PATTERN = /^<!-- Build ID: ([0-9a-f]{12}) -->$/;

/** Normalize line endings and strip a leading BOM before hashing. */
function normalize(content: string): string {
  return content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

/**
 * Split normalized content the way Python's `str.splitlines()` does for our
 * purposes: a single trailing newline does not create an extra empty line.
 */
function splitLines(content: string): string[] {
  const lines = normalize(content).split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function isBuildIdLine(line: string): boolean {
  return BUILD_ID_LINE_PATTERN.test(line);
}

/**
 * Canonical body used both for hashing and for the persisted output:
 * Build ID lines removed, trailing line whitespace normalized, and trailing
 * blank lines removed. This is the "normalized content excluding the build-id
 * line" from the compile contract.
 */
export function buildIdBody(content: string): string {
  const lines = splitLines(content)
    .filter((line) => !isBuildIdLine(line))
    .map((line) => line.replace(/[ \t]+$/, ""));
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

/** Deterministic 12-char SHA-256 prefix for normalized content. */
export function computeBuildId(content: string): string {
  return createHash("sha256").update(buildIdBody(content), "utf8").digest("hex").slice(0, 12);
}

/**
 * Replace a sentinel or append the canonical Build ID line near the end.
 * Idempotent: applying it to content that already has one valid line returns
 * byte-identical output.
 */
export function applyBuildId(content: string): string {
  const body = buildIdBody(content.replaceAll(BUILD_ID_PLACEHOLDER, ""));
  const id = computeBuildId(body);
  return body.length > 0 ? `${body}\n\n<!-- Build ID: ${id} -->\n` : `<!-- Build ID: ${id} -->\n`;
}

/** Backward-compatible APM-style alias for sentinel replacement. */
export function stabilizeBuildId(content: string): string {
  return applyBuildId(content);
}

/** True when content carries exactly one canonical Build ID line. */
export function hasBuildIdLine(content: string): boolean {
  return splitLines(content).filter(isBuildIdLine).length === 1;
}

/**
 * True when content has exactly one Build ID line and its id still matches the
 * normalized body. Hand-authored files and edited generated files both fail.
 */
export function hasValidBuildId(content: string): boolean {
  const lines = splitLines(content);
  const ids = lines
    .map((line) => BUILD_ID_LINE_PATTERN.exec(line)?.[1])
    .filter((id): id is string => id !== undefined);
  if (ids.length !== 1) return false;
  return ids[0] === computeBuildId(content);
}
