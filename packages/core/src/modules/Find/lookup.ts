import type { ReverseIndex } from "./types.ts";

/**
 * Normalize a find query: `\`→`/`, strip leading `/` and `./`.
 */
export function normalizeFindPath(query: string): string {
  let normalized = String(query ?? "").replace(/\\/g, "/");
  // Repeatedly strip leading `/` and `./` (handles `/./foo`, `././foo`, etc.)
  for (;;) {
    if (normalized.startsWith("/")) {
      normalized = normalized.slice(1);
      continue;
    }
    if (normalized.startsWith("./")) {
      normalized = normalized.slice(2);
      continue;
    }
    break;
  }
  return normalized;
}

/**
 * Lookup owners for a query path: exact match, else longest `/`-suffix directory prefix.
 * Also treats a query that ends with `/` as a directory prefix over indexed entries (APM parity).
 */
export function lookupInIndex(
  query: string,
  index: ReverseIndex | Map<string, string[]> | Record<string, string[]>,
): string[] {
  const normalized = normalizeFindPath(query);
  const map = toMap(index);

  if (map.has(normalized)) {
    return [...(map.get(normalized) ?? [])];
  }

  let bestMatch: string[] | null = null;
  let bestPrefixLen = -1;

  for (const [entry, owners] of map.entries()) {
    if (entry.endsWith("/") && normalized.startsWith(entry)) {
      if (entry.length > bestPrefixLen) {
        bestPrefixLen = entry.length;
        bestMatch = owners;
      }
    } else if (normalized.endsWith("/") && entry.startsWith(normalized)) {
      if (normalized.length > bestPrefixLen) {
        bestPrefixLen = normalized.length;
        bestMatch = owners;
      }
    }
  }

  return bestMatch ? [...bestMatch] : [];
}

function toMap(
  index: ReverseIndex | Map<string, string[]> | Record<string, string[]>,
): Map<string, string[]> {
  if (index instanceof Map) return index;
  return new Map(Object.entries(index));
}

export const lookup = lookupInIndex;
export const lookupFindPath = lookupInIndex;
export const lookupReverseIndex = lookupInIndex;
