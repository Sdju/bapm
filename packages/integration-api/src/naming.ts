/**
 * Shared naming helpers for host-owned file layouts.
 */

import type { AttributedPrimitive } from "./types.ts";
import { sanitizeName } from "./helpers.ts";

/** Stable package key for a primitive (`packageName`, dependency source, or `local`). */
export function primitivePackageKey(primitive: AttributedPrimitive): string {
  if (typeof primitive.packageName === "string" && primitive.packageName.trim()) {
    return sanitizeName(primitive.packageName);
  }
  const source = String(primitive.source ?? "");
  if (source.startsWith("dependency:")) {
    return sanitizeName(source.slice("dependency:".length));
  }
  return "local";
}

/** Lowercase, path-safe slug for hook file names. */
export function safeHookSlug(value: string, fallback = "hook"): string {
  const safe = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "");
  return safe || fallback;
}
