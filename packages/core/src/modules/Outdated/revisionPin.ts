import semver from "semver";
import type { FakeTag } from "@/modules/Resolver";
import { normalizeRepoIdentity } from "@/modules/Resolver";

/** Exact 40-hex full revision pin (APM `is_full_revision_pin`). */
const FULL_SHA_RE = /^[a-fA-F0-9]{40}$/;

/** APM git_semver_resolver DEFAULT_TAG_PATTERNS + FALLBACK_BARE_PATTERN. */
const TAG_PATTERNS = ["v{version}", "{name}--v{version}", "{name}-v{version}", "{version}"] as const;

const VERSION_CAPTURE =
  String.raw`(?<version>\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)`;

export type AnnotatedTagCandidate = {
  tag: string;
  commit: string;
};

export function isFullRevisionPin(ref: string | undefined | null): boolean {
  if (typeof ref !== "string") return false;
  return FULL_SHA_RE.test(ref.trim());
}

export function abbreviateSha(sha: string, n = 8): string {
  return sha.slice(0, n).toLowerCase();
}

/** Basename for `{name}` tag patterns (repo URL or `path:` virtual). */
export function packageBasenameFromRepo(repoUrl: string): string {
  const trimmed = repoUrl.trim();
  if (/^(path:|local:)/i.test(trimmed)) {
    const path = trimmed.replace(/^(path:|local:)/i, "").replace(/\/+$/, "");
    const seg = path.split(/[/\\]/).filter(Boolean).pop();
    return seg ?? path;
  }
  const identity = normalizeRepoIdentity(
    trimmed.includes("://") || trimmed.startsWith("git@") ? trimmed : `https://${trimmed}`,
  );
  const seg = identity.split("/").filter(Boolean).pop();
  return seg ?? identity;
}

/**
 * Highest non-prerelease annotated semver tag (APM `find_latest_annotated_tag`).
 * Only `annotated === true`; lightweight / missing evidence excluded (fail-closed).
 */
export function findLatestAnnotatedTag(
  tags: FakeTag[],
  packageName: string,
): AnnotatedTagCandidate | null {
  const candidates: Array<{ version: semver.SemVer; tag: string; commit: string }> = [];

  for (const entry of tags) {
    if (entry.annotated !== true) continue;
    const versionStr = matchTagVersion(entry.tag, packageName);
    if (!versionStr) continue;
    const parsed = semver.parse(versionStr);
    if (!parsed || parsed.prerelease.length > 0) continue;
    candidates.push({ version: parsed, tag: entry.tag, commit: entry.commit });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => semver.rcompare(a.version, b.version));
  const best = candidates[0]!;
  return { tag: best.tag, commit: best.commit };
}

function matchTagVersion(tag: string, packageName: string): string | null {
  for (const pattern of TAG_PATTERNS) {
    const rx = buildTagRegex(pattern, packageName);
    const m = rx.exec(tag);
    if (m?.groups?.version) return m.groups.version;
  }
  return null;
}

function buildTagRegex(pattern: string, packageName: string): RegExp {
  const nameLit = escapeRegExp(packageName);
  const withName = pattern.replaceAll("{name}", `\0NAME\0`).replaceAll("{version}", `\0VERSION\0`);
  const escaped = escapeRegExp(withName)
    .replaceAll(escapeRegExp("\0VERSION\0"), VERSION_CAPTURE)
    .replaceAll(escapeRegExp("\0NAME\0"), nameLit || "[^/]+");
  return new RegExp(`^${escaped}$`);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
