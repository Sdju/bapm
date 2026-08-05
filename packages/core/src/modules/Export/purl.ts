/**
 * Package URL identity + URL credential scrubbing for SBOM export.
 * Port of APM `apm_cli.export.purl` — lock fields only, no network.
 */

import type { InventoryDep } from "./types.ts";

const HOST_TYPE_TO_PURL: Record<string, string> = {
  github: "github",
  gitlab: "gitlab",
  bitbucket: "bitbucket",
};

const HOST_DOMAIN_TO_PURL: Record<string, string> = {
  "github.com": "github",
  "gitlab.com": "gitlab",
  "bitbucket.org": "bitbucket",
};

function hostSegment(repoUrl: string): string {
  const parts = repoUrl.split("/").filter(Boolean);
  if (parts[0] && parts[0].includes(".")) return parts[0].toLowerCase();
  return "";
}

function purlTypeFor(dep: InventoryDep): string | undefined {
  const explicit = HOST_TYPE_TO_PURL[(dep.host_type ?? "").toLowerCase()];
  if (explicit) return explicit;
  return HOST_DOMAIN_TO_PURL[hostSegment(dep.repo_url)];
}

function ownerRepo(repoUrl: string): string {
  const parts = repoUrl.split("/").filter(Boolean);
  if (parts[0] && parts[0].includes(".")) parts.shift();
  return parts.join("/");
}

function basename(repoUrl: string): string {
  const or = ownerRepo(repoUrl);
  if (!or) return repoUrl;
  const segs = or.split("/");
  return segs[segs.length - 1] ?? repoUrl;
}

function encodeSegment(segment: string): string {
  return encodeURIComponent(segment);
}

function encodePath(ownerRepoPath: string): string {
  return ownerRepoPath.split("/").map(encodeSegment).join("/");
}

function isOci(dep: InventoryDep): boolean {
  return Boolean(dep.resolved_url && String(dep.resolved_url).startsWith("oci://"));
}

function isLocal(dep: InventoryDep): boolean {
  return dep.source === "local";
}

/**
 * Remove embedded credentials from *url* before it appears in SBOM output.
 * Drops userinfo and the entire query string; keeps scheme/host/port/path/fragment.
 */
export function scrubUrl(url: string): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    const hasUserinfo = Boolean(parsed.username || parsed.password);
    if (!hasUserinfo && !parsed.search) return url;
    const host =
      parsed.port && parsed.port !== ""
        ? `${parsed.hostname}:${parsed.port}`
        : parsed.hostname;
    return `${parsed.protocol}//${host}${parsed.pathname}${parsed.hash}`;
  } catch {
    return url;
  }
}

/** Build the Package URL identity for *dep* from lockfile fields only. */
export function buildPurl(dep: InventoryDep): string {
  if (isOci(dep)) {
    const name = encodeSegment(basename(dep.repo_url));
    const digest = dep.resolved_hash ?? dep.content_hash;
    return digest ? `pkg:oci/${name}@${digest}` : `pkg:oci/${name}`;
  }

  if (!isLocal(dep) && dep.resolved_commit) {
    const purlType = purlTypeFor(dep);
    if (purlType) {
      return `pkg:${purlType}/${encodePath(ownerRepo(dep.repo_url))}@${dep.resolved_commit}`;
    }
    return `pkg:generic/${encodeSegment(basename(dep.repo_url))}@${dep.resolved_commit}`;
  }

  const name = encodeSegment(basename(dep.repo_url));
  const version = dep.content_hash;
  return version ? `pkg:generic/${name}@${version}` : `pkg:generic/${name}`;
}

export function componentName(dep: InventoryDep): string {
  const or = ownerRepo(dep.repo_url);
  return or || dep.repo_url;
}

export function componentVersion(dep: InventoryDep): string | undefined {
  return (
    dep.version ||
    dep.resolved_commit ||
    dep.resolved_hash ||
    dep.content_hash ||
    undefined
  );
}
