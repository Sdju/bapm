import semver from "semver";

/**
 * OpenAPM node-semver dialect helpers (req-rs-007 / req-rs-014).
 * Comma AND (`>=1.0.0, <1.5.0`) normalized to space-separated ranges for node-semver.
 */

export function normalizeSemverRange(range: string): string {
  return range.trim().replace(/,/g, " ").replace(/\s+/g, " ");
}

export function isValidSemverRange(range: string): boolean {
  return semver.validRange(normalizeSemverRange(range)) !== null;
}

export function versionSatisfies(
  version: string,
  range: string,
  options?: { includePrerelease?: boolean },
): boolean {
  const clean = stripTagPrefix(version);
  const r = normalizeSemverRange(range);
  try {
    return semver.satisfies(clean, r, {
      includePrerelease: options?.includePrerelease === true,
    });
  } catch {
    return false;
  }
}

/**
 * Pick highest satisfying tag among candidates.
 * Prereleases excluded unless range opts in (contains prerelease id) or includePrerelease.
 * Build-metadata ties: highest ASCII full tag string (req-rs-014).
 */
export function pickHighestSatisfyingTag(
  tags: string[],
  range: string,
  options?: { includePrerelease?: boolean },
): string | null {
  const r = normalizeSemverRange(range);
  const includePrerelease = options?.includePrerelease === true || rangeIncludesPrerelease(r);

  const matching: string[] = [];
  for (const tag of tags) {
    const ver = stripTagPrefix(tag);
    const parsed = semver.parse(ver);
    if (!parsed) continue;

    if (parsed.prerelease.length > 0 && !includePrerelease) {
      // node-semver: prerelease only matches if range also has prerelease on same tuple
      if (!versionSatisfies(ver, r, { includePrerelease: false })) {
        continue;
      }
    }

    if (!versionSatisfies(ver, r, { includePrerelease })) {
      continue;
    }
    matching.push(tag);
  }

  if (matching.length === 0) return null;

  matching.sort((a, b) => compareTagsHighestFirst(a, b));
  return matching[0]!;
}

/**
 * Intersect multiple ranges; return highest version among candidate tags in ∩,
 * or null if empty.
 */
export function pickHighestInIntersection(
  tags: string[],
  ranges: string[],
  options?: { includePrerelease?: boolean },
): string | null {
  if (ranges.length === 0) return null;
  if (ranges.length === 1) {
    return pickHighestSatisfyingTag(tags, ranges[0]!, options);
  }

  const normalized = ranges.map(normalizeSemverRange);
  const includePrerelease =
    options?.includePrerelease === true || normalized.some(rangeIncludesPrerelease);

  const matching: string[] = [];
  for (const tag of tags) {
    const ver = stripTagPrefix(tag);
    if (!semver.parse(ver)) continue;
    const ok = normalized.every((r) => versionSatisfies(ver, r, { includePrerelease }));
    if (ok) matching.push(tag);
  }

  if (matching.length === 0) return null;
  matching.sort((a, b) => compareTagsHighestFirst(a, b));
  return matching[0]!;
}

/** Which range is "tightest" among a set (prefer narrower / more specific). */
export function pickTightestRange(ranges: string[]): string {
  if (ranges.length === 0) return "";
  if (ranges.length === 1) return ranges[0]!;

  // Prefer tilde over caret over broad; among equals prefer longer / more specific string
  const scored = ranges.map((r) => ({
    r,
    score: rangeTightnessScore(r),
  }));
  scored.sort((a, b) => b.score - a.score || b.r.length - a.r.length);
  return scored[0]!.r;
}

function rangeTightnessScore(range: string): number {
  const r = normalizeSemverRange(range);
  let score = 0;
  if (r.startsWith("~")) score += 30;
  else if (r.startsWith("^")) score += 20;
  else if (r.includes("<") || r.includes(">")) score += 25;
  // Fewer wildcards = tighter
  if (!/[xX*]/.test(r)) score += 5;
  // Exact version
  if (/^v?\d+\.\d+\.\d+/.test(r) && !/[\^~<>|]/.test(r)) score += 40;
  return score;
}

/**
 * Compare tags highest-first: semver precedence, then ASCII full tag for build-metadata ties.
 */
function compareTagsHighestFirst(a: string, b: string): number {
  const va = stripTagPrefix(a);
  const vb = stripTagPrefix(b);
  const cmp = semver.rcompare(va, vb);
  if (cmp !== 0) return cmp;
  // Equal semver (incl. ignored build metadata) → highest ASCII full tag string
  if (a < b) return 1;
  if (a > b) return -1;
  return 0;
}

export function stripTagPrefix(tag: string): string {
  return tag.trim().replace(/^v/i, "");
}

function rangeIncludesPrerelease(range: string): boolean {
  // e.g. >=1.1.0-alpha
  return /-\w/.test(range);
}
