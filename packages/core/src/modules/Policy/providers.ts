/**
 * Ordered policy discovery providers (pl-011/012):
 * local dual-read → GitHub owner-org cascade → Azure DevOps org policy.
 */

import { basename } from "node:path";
import { ADO_POLICY_COORDINATES, buildAdoPolicyApiUrl, parseAdoRepoFromRemoteUrl } from "./ado.ts";
import {
  APM_POLICY_FILE,
  DEFAULT_POLICY_PROVIDERS,
  POLICY_PROVIDER_LOCAL,
  POLICY_PROVIDER_AZURE_DEVOPS_ORG_POLICY,
  POLICY_PROVIDER_GITHUB_OWNER_DOTGITHUB,
  POLICY_REPO_CANDIDATES_GITHUB,
} from "./constants.ts";
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

export type PolicyProviderId =
  | "local"
  | "github-owner-dotgithub"
  | "azure-devops-org-policy"
  | (string & {});

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
  /** Extra Azure DevOps Server hosts (in addition to ADO_HOST / APM_ADO_HOSTS). */
  adoHosts?: string[];
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
    if (provider === POLICY_PROVIDER_LOCAL) {
      const local = discoverLocal(cwd, options.path);
      if (local) return local;
      continue;
    }

    if (provider === POLICY_PROVIDER_GITHUB_OWNER_DOTGITHUB) {
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

    if (isAzureDevOpsProvider(provider)) {
      const remote = discoverAzureDevOpsOrgPolicy({
        cwd,
        adoHosts: options.adoHosts,
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

/**
 * Provider list for `--no-policy` (repo-local skip): keep remote/org providers
 * so organization deny still applies. Explicit `--policy <path>` still wins.
 */
export function filterNonLocalPolicyProviders(providers?: string[]): string[] {
  const list = providers ?? [...DEFAULT_POLICY_PROVIDERS];
  return list.filter((provider) => provider !== POLICY_PROVIDER_LOCAL);
}

/** Accepted Azure DevOps provider ids / aliases. */
export function isAzureDevOpsProvider(provider: string): boolean {
  return (
    provider === POLICY_PROVIDER_AZURE_DEVOPS_ORG_POLICY ||
    provider === "azure-devops-org" ||
    provider === "ado-org-policy" ||
    provider === "ado-org" ||
    provider === "azure-devops"
  );
}

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

type RemoteFetchOutcome =
  | { kind: "found"; text: string }
  | { kind: "not-found" }
  | { kind: "absent" };

function fetchRemotePolicy(args: {
  url: string;
  fetcher?: (url: string) => HttpFetchResult;
  fetchFailure: "off" | "warn" | "block";
  provider: string;
}): RemoteFetchOutcome {
  if (!args.fetcher) return { kind: "absent" };

  let res: HttpFetchResult;
  try {
    res = args.fetcher(args.url);
  } catch (cause) {
    return handleFetchFailure(args, cause);
  }

  if (res?.status === 404) return { kind: "not-found" };

  const text = res?.text ?? res?.body;
  if (res?.ok === false || text == null) {
    return handleFetchFailure(args, undefined, res);
  }

  return { kind: "found", text };
}

function handleFetchFailure(
  args: {
    url: string;
    fetchFailure: "off" | "warn" | "block";
    provider: string;
  },
  cause?: unknown,
  res?: HttpFetchResult,
): RemoteFetchOutcome {
  if (args.fetchFailure === "block") {
    const suffix =
      res?.status != null
        ? ` status=${res.status}`
        : cause instanceof Error
          ? ` network=${cause.message}`
          : "";
    throw new PolicyError(
      "POLICY_FETCH_FAILURE",
      `Remote policy fetch failed (block/${args.provider}): ${args.url}${suffix}`,
      {
        details: { url: args.url, status: res?.status, provider: args.provider },
        ...(cause !== undefined ? { cause } : {}),
      },
    );
  }
  return { kind: "absent" };
}

function parseRemoteText(url: string, text: string): ReturnType<typeof parsePolicyDocument> {
  const raw = loadYamlDocument(text, url);
  return parsePolicyDocument(raw);
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
  const selected = selectProjectRemote({
    cwd: args.cwd,
    remotes: args.remotes,
    listGitRemotes: args.listGitRemotes ?? ((c) => listGitRemotes(c)),
  });

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

  const fetcher = args.fetchPolicyUrl ?? args.httpGet;
  if (!fetcher) {
    // No network in production without injector — treat as absent (skip)
    return null;
  }

  for (const candidate of POLICY_REPO_CANDIDATES_GITHUB) {
    const policyUrl = `https://${parsed.host}/${parsed.owner}/${candidate}/${APM_POLICY_FILE}`;
    const fetched = fetchRemotePolicy({
      url: policyUrl,
      fetcher,
      fetchFailure: args.fetchFailure,
      provider: POLICY_PROVIDER_GITHUB_OWNER_DOTGITHUB,
    });
    if (fetched.kind === "absent") return null;
    if (fetched.kind === "not-found") continue;

    const parsedDoc = parseRemoteText(policyUrl, fetched.text);
    return {
      found: true,
      provider: POLICY_PROVIDER_GITHUB_OWNER_DOTGITHUB,
      url: policyUrl,
      path: policyUrl,
      filename: basename(APM_POLICY_FILE),
      document: parsedDoc.document,
      policy: parsedDoc.document,
      text: fetched.text,
      source: policyUrl,
    };
  }

  return null;
}

function discoverAzureDevOpsOrgPolicy(args: {
  cwd: string;
  adoHosts?: string[];
  listGitRemotes?: (cwd?: string) => GitRemoteEntry[];
  remotes?: GitRemoteEntry[];
  fetchPolicyUrl?: (url: string) => HttpFetchResult;
  httpGet?: (url: string) => HttpFetchResult;
  fetchFailure: "off" | "warn" | "block";
}): DiscoverPolicyWithProvidersResult | null {
  const selected = selectProjectRemote({
    cwd: args.cwd,
    remotes: args.remotes,
    listGitRemotes: args.listGitRemotes ?? ((c) => listGitRemotes(c)),
  });

  if (
    selected == null ||
    ("absent" in selected && selected.absent) ||
    ("skipped" in selected && selected.skipped)
  ) {
    return null;
  }

  const coordinates = parseAdoRepoFromRemoteUrl(selected.url, adoEnv(args.adoHosts));
  if (!coordinates) return null;

  const fetcher = args.fetchPolicyUrl ?? args.httpGet;
  if (!fetcher) {
    // No network in production without injector — treat as absent (skip)
    return null;
  }

  for (const candidate of ADO_POLICY_COORDINATES) {
    const policyUrl = buildAdoPolicyApiUrl({
      host: coordinates.host,
      ...(coordinates.port !== undefined ? { port: coordinates.port } : {}),
      org: coordinates.org,
      project: candidate.project,
      repo: candidate.repo,
    });
    const fetched = fetchRemotePolicy({
      url: policyUrl,
      fetcher,
      fetchFailure: args.fetchFailure,
      provider: POLICY_PROVIDER_AZURE_DEVOPS_ORG_POLICY,
    });
    if (fetched.kind === "absent") return null;
    if (fetched.kind === "not-found") continue;

    const parsedDoc = parseRemoteText(policyUrl, fetched.text);
    return {
      found: true,
      provider: POLICY_PROVIDER_AZURE_DEVOPS_ORG_POLICY,
      url: policyUrl,
      path: policyUrl,
      filename: basename(APM_POLICY_FILE),
      document: parsedDoc.document,
      policy: parsedDoc.document,
      text: fetched.text,
      source: policyUrl,
    };
  }

  return null;
}

function adoEnv(adoHosts?: string[]): NodeJS.ProcessEnv {
  if (adoHosts === undefined) return process.env;
  const hosts = adoHosts.map((host) => host.trim()).filter(Boolean);
  return {
    ...process.env,
    ADO_HOST: hosts[0] ?? "",
    APM_ADO_HOSTS: hosts.slice(1).join(","),
  };
}
