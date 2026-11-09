/**
 * Shared JSON/JSONC document helpers for host configuration files.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type ReadJsonDocumentOptions = {
  /** Absolute path to the config file. */
  path: string;
  /** Human-readable label used in strict-mode errors. */
  label?: string;
  /** Throw with `label` context instead of returning an empty object. */
  strict?: boolean;
  /** Strip comments and trailing commas before parsing. */
  jsonc?: boolean;
};

function readFailure(options: ReadJsonDocumentOptions, detail: string, cause?: unknown): never {
  const label = options.label ?? options.path;
  throw new Error(`Cannot read ${label}: ${detail}`, cause === undefined ? undefined : { cause });
}

function malformedFailure(
  options: ReadJsonDocumentOptions,
  detail: string,
  cause?: unknown,
): never {
  const label = options.label ?? options.path;
  throw new Error(
    `${label} is malformed JSON: ${detail}`,
    cause === undefined ? undefined : { cause },
  );
}

/**
 * Read a JSON object. Missing files return `{}`.
 * Malformed or non-object documents return `{}` unless `strict` is set.
 */
export function readJsonDocument(options: ReadJsonDocumentOptions): Record<string, unknown> {
  const { path } = options;
  if (!existsSync(path)) return {};

  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (cause) {
    if (options.strict) {
      readFailure(options, cause instanceof Error ? cause.message : String(cause), cause);
    }
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(options.jsonc ? stripJsonc(raw) : raw);
  } catch (cause) {
    if (options.strict) {
      malformedFailure(options, cause instanceof Error ? cause.message : String(cause), cause);
    }
    return {};
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    if (options.strict) malformedFailure(options, "expected a JSON object");
    return {};
  }
  return { ...(parsed as Record<string, unknown>) };
}

/** Write a JSON document with parents, two-space indentation, and a trailing newline. */
export function writeJsonDocument(path: string, document: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`, "utf8");
}

/**
 * Strip JSONC line/block comments and trailing commas while preserving strings.
 * Comments are replaced with spaces so line/column positions stay stable.
 */
export function stripJsonc(raw: string): string {
  const chars = raw.split("");
  let inString = false;
  let escaped = false;
  let index = 0;
  while (index < chars.length) {
    const char = chars[index]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      index += 1;
      continue;
    }
    if (char === '"') {
      inString = true;
      index += 1;
      continue;
    }
    if (char === "/" && chars[index + 1] === "/") {
      while (index < chars.length && chars[index] !== "\n" && chars[index] !== "\r") {
        chars[index] = " ";
        index += 1;
      }
      continue;
    }
    if (char === "/" && chars[index + 1] === "*") {
      const end = raw.indexOf("*/", index + 2);
      const stop = end === -1 ? chars.length : end + 2;
      while (index < stop) {
        if (chars[index] !== "\n" && chars[index] !== "\r") chars[index] = " ";
        index += 1;
      }
      continue;
    }
    if (char === ",") {
      let next = index + 1;
      while (next < chars.length && /\s/.test(chars[next]!)) next += 1;
      if (chars[next] === "}" || chars[next] === "]") {
        chars[index] = " ";
      }
    }
    index += 1;
  }
  return chars.join("");
}
