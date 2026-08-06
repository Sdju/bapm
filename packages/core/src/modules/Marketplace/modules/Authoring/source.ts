/**
 * Authoring package source validators (OpenAPM req-mf-017 / APM SOURCE_RE).
 */

const HOST_PAT =
  "(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\\.)+[A-Za-z][A-Za-z0-9-]*";
const SEGMENT_PAT = "[A-Za-z0-9._-]+";
const OWNER_REPO_PAT = `${SEGMENT_PAT}/${SEGMENT_PAT}`;
const HTTPS_REPOSITORY_PAT = `${SEGMENT_PAT}(?:/${SEGMENT_PAT})+`;

const SOURCE_RE = new RegExp(
  `^(?:https://${HOST_PAT}/${HTTPS_REPOSITORY_PAT}(?:\\.git)?|${HOST_PAT}/${OWNER_REPO_PAT}|${OWNER_REPO_PAT}|\\./.*)$`,
);

const HOST_PREFIXED_SOURCE_RE = new RegExp(`^(${HOST_PAT})/(${OWNER_REPO_PAT})$`);
const HTTPS_URL_SOURCE_RE = new RegExp(
  `^https://(${HOST_PAT})/(${HTTPS_REPOSITORY_PAT})(?:\\.git)?$`,
);
const OWNER_REPO_ONLY_RE = new RegExp(`^${OWNER_REPO_PAT}$`);

/** Common project-local roots that must use `./` (mf-017 local form). */
const BARE_LOCAL_ROOTS = new Set([
  "plugins",
  "packages",
  "src",
  "lib",
  "dist",
  "vendor",
  "modules",
  "apps",
  "services",
]);

export type SourceValidationResult = { ok: true } | { ok: false; error: string };

export function isLocalAuthoringSource(source: string): boolean {
  return source.startsWith("./");
}

export function splitHostFromAuthoringSource(source: string): {
  host: string | null;
  repoPath: string;
} {
  const https = HTTPS_URL_SOURCE_RE.exec(source);
  if (https) {
    let ownerRepo = https[2]!;
    if (ownerRepo.endsWith(".git")) ownerRepo = ownerRepo.slice(0, -".git".length);
    return { host: https[1]!, repoPath: ownerRepo };
  }
  const hostPrefixed = HOST_PREFIXED_SOURCE_RE.exec(source);
  if (hostPrefixed) return { host: hostPrefixed[1]!, repoPath: hostPrefixed[2]! };
  return { host: null, repoPath: source };
}

/** True when remote is default-host github `owner/repo` (no FQDN prefix). */
export function isGithubOwnerRepoShorthand(source: string): boolean {
  if (isLocalAuthoringSource(source)) return false;
  if (source.includes("://")) return false;
  if (HOST_PREFIXED_SOURCE_RE.test(source)) return false;
  return OWNER_REPO_ONLY_RE.test(source);
}

export function githubHttpsUrlFromOwnerRepo(source: string): string {
  return `https://github.com/${source.replace(/\.git$/, "")}.git`;
}

function hasPathTraversal(source: string): boolean {
  const normalized = source.replace(/^\.\//, "");
  return normalized.split(/[/\\]/).some((seg) => seg === "..");
}

function looksLikeBareLocalWithoutDotSlash(source: string): boolean {
  if (source.startsWith("./") || source.includes("://")) return false;
  if (HOST_PREFIXED_SOURCE_RE.test(source)) return false;
  const first = source.split("/")[0] ?? "";
  return BARE_LOCAL_ROOTS.has(first);
}

function rejectUrlUnsafeParts(source: string): string | undefined {
  if (!source.startsWith("https://")) return undefined;
  try {
    const u = new URL(source);
    if (u.username || u.password || source.includes("@")) {
      return "source must not include userinfo";
    }
    if (u.port) return "source must not include a port";
    if (u.search) return "source must not include a query string";
    if (u.protocol !== "https:") return "remote sources must use https://";
  } catch {
    return "source is not a valid https URL";
  }
  // Extra belt: raw patterns APM rejects even if URL parser is lenient
  if (/^https:\/\/[^/]*@/.test(source)) return "source must not include userinfo";
  if (/^https:\/\/[^/]+:\d+\//.test(source)) return "source must not include a port";
  if (source.includes("?")) return "source must not include a query string";
  return undefined;
}

/**
 * Validate authoring package `source` (req-mf-017 / APM SOURCE_RE).
 * Returns `{ ok }` shape (also usable as boolean via helpers).
 */
export function validateMarketplaceAuthoringSource(source: string): SourceValidationResult {
  if (typeof source !== "string" || !source.trim()) {
    return { ok: false, error: "source must be a non-empty string" };
  }
  const s = source.trim();

  if (hasPathTraversal(s)) {
    return { ok: false, error: "source must not contain '..' path segments" };
  }

  if (looksLikeBareLocalWithoutDotSlash(s)) {
    return {
      ok: false,
      error: `local sources MUST begin with './' (got '${s}')`,
    };
  }

  const urlErr = rejectUrlUnsafeParts(s);
  if (urlErr) return { ok: false, error: urlErr };

  if (s.startsWith("http://")) {
    return { ok: false, error: "remote sources must use https://" };
  }

  if (!SOURCE_RE.test(s)) {
    return {
      ok: false,
      error:
        `source must be one of '<owner>/<repo>', '<host.tld>/<owner>/<repo>', ` +
        `'https://<host.tld>/<owner>/<repo>[.git]', or './<path>' (got '${s}')`,
    };
  }

  return { ok: true };
}

/** Boolean / throw-friendly alias. */
export function isValidMarketplaceAuthoringSource(source: string): boolean {
  return validateMarketplaceAuthoringSource(source).ok;
}

export {
  SOURCE_RE as AUTHORING_SOURCE_RE,
  HOST_PREFIXED_SOURCE_RE,
  HTTPS_URL_SOURCE_RE,
  OWNER_REPO_ONLY_RE,
};
