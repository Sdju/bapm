/**
 * Azure DevOps remote parsing + policy API URL construction (APM 0.35 parity).
 *
 * Supports:
 * - `https://dev.azure.com/{org}/{project}/_git/{repo}` (org in path)
 * - `https://{org}.visualstudio.com/{project}/_git/{repo}` (org in subdomain)
 * - `git@ssh.dev.azure.com:v3/{org}/{project}/{repo}` (org/project in path)
 * - on-prem ADO Server roots allowlisted via `ADO_HOST` / `APM_ADO_HOSTS`
 */

import { collectAdoHosts } from "@/modules/Auth";
import { APM_POLICY_FILE } from "./constants.ts";

export const ADO_API_HOST = "dev.azure.com";
export const ADO_SSH_HOST = "ssh.dev.azure.com";

export type AdoRepoCoordinates = {
  /** Host named by the git remote (used for host-class pinning). */
  host: string;
  /** Host used for the REST API (ssh.dev.azure.com maps to dev.azure.com). */
  apiHost: string;
  /** Optional non-default HTTPS port (ADO Server). */
  port?: number;
  org: string;
  project: string;
  repo: string;
  legacyVisualStudio: boolean;
};

function normalizeHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[|\]$/g, "");
}

function configuredAdoHosts(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): Set<string> {
  return collectAdoHosts(env as NodeJS.ProcessEnv);
}

/** True for cloud / legacy / configured on-prem Azure DevOps hosts. */
export function isAzureDevOpsHost(
  host: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  const h = normalizeHost(host);
  if (!h) return false;
  if (h === ADO_API_HOST || h === ADO_SSH_HOST) return true;
  if (h.endsWith(".visualstudio.com")) return true;
  return configuredAdoHosts(env).has(h);
}

/**
 * Parse an Azure DevOps git remote into policy-fetch coordinates.
 * Returns null when the URL is not on an accepted ADO host or lacks the
 * documented org/project/repo shape.
 */
export function parseAdoRepoFromRemoteUrl(
  url: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): AdoRepoCoordinates | null {
  if (!url) return null;
  const raw = url.trim();
  if (!raw) return null;

  let host: string;
  let port: number | undefined;
  let segments: string[];

  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
      const parsed = new URL(raw);
      host = normalizeHost(parsed.hostname);
      port = parsed.port ? Number(parsed.port) : undefined;
      segments = splitPath(parsed.pathname);
    } else {
      const scp = /^(?:[^@/\s]+@)?([^:/\s]+):(.+)$/.exec(raw);
      if (!scp) return null;
      host = normalizeHost(scp[1]!);
      segments = splitPath(scp[2]!);
    }
  } catch {
    return null;
  }

  if (!isAzureDevOpsHost(host, env)) return null;

  const legacyVisualStudio = host.endsWith(".visualstudio.com");

  // SSH remotes carry a leading `v3/` segment that is not the org.
  if (segments[0] === "v3" && segments.length >= 4) {
    const org = segments[1]!;
    const project = segments[2]!;
    const repo = segments[3]!;
    if (!org || !project || !repo) return null;
    return {
      host,
      apiHost: apiHostFor(host),
      ...(port !== undefined ? { port } : {}),
      org,
      project,
      repo,
      legacyVisualStudio,
    };
  }

  const gitIndex = segments.indexOf("_git");
  if (gitIndex < 0) return null;
  const repo = segments[gitIndex + 1];
  if (!repo) return null;
  const before = segments.slice(0, gitIndex);

  let org: string | undefined;
  let project: string | undefined;
  if (legacyVisualStudio && !host.startsWith("vs-ssh.")) {
    // Legacy `*.visualstudio.com`: org lives in the subdomain, path before
    // `_git` is just the project (optionally after `DefaultCollection`).
    org = host.split(".")[0];
    project = before[before.length - 1];
  } else if (before.length >= 2) {
    // `dev.azure.com/{org}/{project}` or ADO Server `{collection}/{project}`.
    org = before[0];
    project = before[1];
  }

  if (!org || !project) return null;
  return {
    host,
    apiHost: apiHostFor(host),
    ...(port !== undefined ? { port } : {}),
    org,
    project,
    repo,
    legacyVisualStudio,
  };
}

/** Build the documented ADO Items API URL for `apm-policy.yml`. */
export function buildAdoPolicyApiUrl(
  coordinates: Pick<AdoRepoCoordinates, "org" | "project" | "repo" | "host" | "port">,
  options: { path?: string; ref?: string; file?: string } = {},
): string {
  const apiHost = apiHostFor(coordinates.host);
  const netloc =
    coordinates.port !== undefined && coordinates.port !== null
      ? `${apiHost}:${coordinates.port}`
      : apiHost;
  const legacyVisualStudio = apiHost.endsWith(".visualstudio.com");
  const orgPath = legacyVisualStudio ? "" : `${encodeURIComponent(coordinates.org)}/`;
  const file = options.file ?? options.path ?? APM_POLICY_FILE;
  const ref = options.ref ?? "main";
  return (
    `https://${netloc}/${orgPath}${encodeURIComponent(coordinates.project)}` +
    `/_apis/git/repositories/${encodeURIComponent(coordinates.repo)}/items` +
    `?path=${encodeURIComponent(file)}` +
    `&versionDescriptor.version=${encodeURIComponent(ref)}` +
    `&api-version=7.0`
  );
}

/** Documented ADO policy coordinates, primary then temporary legacy fallback. */
export const ADO_POLICY_COORDINATES = [
  { project: "apm", repo: "apm-policy", legacy: false },
  { project: "_apm", repo: "_apm", legacy: true },
] as const;

function apiHostFor(host: string): string {
  if (host === ADO_SSH_HOST) return ADO_API_HOST;
  return host;
}

function splitPath(path: string): string[] {
  return path
    .replace(/^\//, "")
    .replace(/\.git$/i, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
}
