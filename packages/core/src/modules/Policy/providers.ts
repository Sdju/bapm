/**
 * Ordered policy discovery providers (pl-011/012) including minimal github-owner-dotgithub.
 */

import { basename } from "node:path";
import { APM_POLICY_FILE, DEFAULT_POLICY_PROVIDERS } from "./constants.ts";
import { discoverPolicyPath } from "./discover.ts";
import { PolicyError } from "./errors.ts";
import { IMPLEMENTATION_DEFAULT_HOST, hostClassOf } from "./hostClass.ts";
import { parsePolicyDocument } from "./parse.ts";
import {
  listGitRemotes,
  parseOwnerRepoFromRemoteUrl,
  selectProjectRemote,
  type GitRemoteEntry,
} from "./remotes.ts";
import type { DiscoveredPolicy, PolicyDocument } from "./types.ts";
import { loadYamlDocument } from "./yaml-load.ts";

export type PolicyProviderId = "local" | "github-owner-dotgithub" | (string & {});

export type DiscoverPolicyWithProvidersOptions = {
  cwd?: string;
  /** Override provider order (else DEFAULT_POLICY_PROVIDERS or discovery:). */
  providers?: string[];
  policyProviders?: string[];
  /** Explicit local path wins. */
  path?: string;
  listGitRemotes?: (cwd?: string) => GitRemoteEntry[];
  remotes?: GitRemoteEntry[];
  implementationDefaultHost?: string;
  fetchPolicyUrl?: (url: string) => HttpFetchResult;
  httpGet?: (url: string) => HttpFetchResult;
  /** When remote fetch fails before a document exists. */
  defaultFetchFailure?: "off" | "warn" | "block";
};

export type HttpFetchResult = {
  ok?: boolean;
  text?: string;
  body?: string;
  status?: number;
  url?: string;
};

export type DiscoverPolicyWithProvidersResult =
  | {
      absent?: false;
      found: true;
      path?: string;
      filename?: string;
      url?: string;
      provider: string;
      document?: PolicyDocument;
      policy?: PolicyDocument;
      text?: string;
      source?: string;
    }
  | {
      absent: true;
      found?: false;
      path?: null;
      providers?: string[];
      skipped?: boolean;
    };

/**
 * Run ordered discovery providers until one yields a policy.
 */
export function discoverPolicyWithProviders(
  options: DiscoverPolicyWithProvidersOptions = {},
): DiscoverPolicyWithProvidersResult {
  const cwd = options.cwd ?? process.cwd();
  const providers = options.providers ?? options.policyProviders ?? [...DEFAULT_POLICY_PROVIDERS];

  const defaultHost = options.implementationDefaultHost ?? IMPLEMENTATION_DEFAULT_HOST;
  const fetchFailure = options.defaultFetchFailure ?? "block";

  for (const provider of providers) {
    if (provider === "local") {
      const local = discoverLocal(cwd, options.path);
      if (local) return local;
      continue;
    }

    if (provider === "github-owner-dotgithub") {
      const remote = discoverGithubOwnerDotgithub({
        cwd,
        defaultHost,
        listGitRemotes: options.listGitRemotes,
        remotes: options.remotes,
        fetchPolicyUrl: options.fetchPolicyUrl,
        httpGet: options.httpGet,
        fetchFailure,
      });
      if (remote) return remote;
      continue;
    }

    // Unknown provider — skip (do not invent host conventions)
  }

  return { absent: true, found: false, path: null, providers };
}

/** Alias names accepted by acceptance helpers. */
export const runPolicyDiscovery = discoverPolicyWithProviders;
export const discoverPolicyProviders = discoverPolicyWithProviders;

function discoverLocal(cwd: string, path?: string): DiscoverPolicyWithProvidersResult | null {
  const discovered: DiscoveredPolicy = discoverPolicyPath({ cwd, path });
  if ("absent" in discovered && discovered.absent) return null;
  return {
    found: true,
    path: discovered.path,
    filename: discovered.filename,
    provider: "local",
    source: discovered.path,
  };
}

function discoverGithubOwnerDotgithub(args: {
  cwd: string;
  defaultHost: string;
  listGitRemotes?: (cwd?: string) => GitRemoteEntry[];
  remotes?: GitRemoteEntry[];
  fetchPolicyUrl?: (url: string) => HttpFetchResult;
  httpGet?: (url: string) => HttpFetchResult;
  fetchFailure: "off" | "warn" | "block";
}): DiscoverPolicyWithProvidersResult | null {
  let selected;
  try {
    selected = selectProjectRemote({
      cwd: args.cwd,
      remotes: args.remotes,
      listGitRemotes: args.listGitRemotes ?? ((c) => listGitRemotes(c)),
    });
  } catch (err) {
    // Ambiguous remotes fail closed for remote discovery
    throw err;
  }

  if (
    selected == null ||
    ("absent" in selected && selected.absent) ||
    ("skipped" in selected && selected.skipped)
  ) {
    return null;
  }

  const url = selected.url;
  const parsed = parseOwnerRepoFromRemoteUrl(url);
  if (!parsed) return null;

  const remoteHostClass = hostClassOf({ host: parsed.host });
  const defaultHostClass = hostClassOf({ host: args.defaultHost });
  if (remoteHostClass !== defaultHostClass) {
    // Non-default host: do not invent alternate convention
    return null;
  }

  const policyUrl = `https://${parsed.host}/${parsed.owner}/.github/${APM_POLICY_FILE}`;
  const fetcher = args.fetchPolicyUrl ?? args.httpGet;

  if (!fetcher) {
    // No network in production without injector — treat as absent (skip)
    return null;
  }

  try {
    const res = fetcher(policyUrl);
    const text = res.text ?? res.body;
    if (res.ok === false || text == null) {
      if (args.fetchFailure === "block") {
        throw new PolicyError(
          "POLICY_FETCH_FAILURE",
          `Remote policy fetch failed (block): ${policyUrl} status=${res.status ?? "unknown"}`,
          { details: { url: policyUrl, status: res.status } },
        );
      }
      return null;
    }

    const raw = loadYamlDocument(text, policyUrl);
    const parsedDoc = parsePolicyDocument(raw);
    return {
      found: true,
      provider: "github-owner-dotgithub",
      url: policyUrl,
      path: policyUrl,
      filename: basename(APM_POLICY_FILE),
      document: parsedDoc.document,
      policy: parsedDoc.document,
      text,
      source: policyUrl,
    };
  } catch (cause) {
    if (cause instanceof PolicyError) throw cause;
    if (args.fetchFailure === "block") {
      throw new PolicyError(
        "POLICY_FETCH_FAILURE",
        `Remote policy fetch failed (block/network): ${cause instanceof Error ? cause.message : String(cause)}`,
        { details: { url: policyUrl }, cause },
      );
    }
    return null;
  }
}
