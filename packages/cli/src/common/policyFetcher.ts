/**
 * CLI-side synchronous HTTP fetcher for remote policy discovery.
 *
 * Core exposes `fetchPolicyUrl` / `httpGet` as ports; production must supply one
 * or `github-owner-dotgithub` silently stays absent. This module keeps policy
 * fetch npm-dependency-free by shelling out to curl and injects the runner in
 * tests so no test touches the network.
 */

import { spawnSync } from "node:child_process";

/** Shape expected by core remote discovery / extends resolution. */
export type PolicyHttpFetchResult = {
  ok: boolean;
  status: number;
  text?: string;
  body?: string;
  url?: string;
};

export type PolicyFetcher = (url: string) => PolicyHttpFetchResult;

export type PolicyCurlRunResult = {
  status: number | null;
  stdout?: string | Buffer;
  stderr?: string | Buffer;
  error?: unknown;
};

/** Injectable executor (tests pass a fake; production uses spawnSync + curl). */
export type PolicyCurlRunner = (command: string, args: string[]) => PolicyCurlRunResult;

export type CreatePolicyFetcherOptions = {
  /** Injected executor for tests; defaults to `spawnSync`. */
  run?: PolicyCurlRunner;
  /** curl binary name / path (default `curl`). */
  binary?: string;
  /** `--max-time` seconds (default 10). */
  timeoutSeconds?: number;
};

export const POLICY_CURL_TIMEOUT_SECONDS = 10;

/**
 * Build a synchronous policy fetcher.
 *
 * Rejects non-https URLs before invoking curl. Uses curl `--write-out` to
 * preserve the HTTP status (404 = provider candidate absent, 5xx = fetch
 * failure). Missing curl, spawn errors and timeouts map to status 0.
 */
export function createPolicyFetcher(options: CreatePolicyFetcherOptions = {}): PolicyFetcher {
  const binary = options.binary ?? "curl";
  const timeoutSeconds = options.timeoutSeconds ?? POLICY_CURL_TIMEOUT_SECONDS;
  const run: PolicyCurlRunner =
    options.run ??
    ((command, args) =>
      spawnSync(command, args, {
        encoding: "utf8",
        // Process-level backstop slightly above curl's own --max-time.
        timeout: (timeoutSeconds + 5) * 1000,
        maxBuffer: 8 * 1024 * 1024,
      }));

  return (url: string): PolicyHttpFetchResult => {
    if (!isHttpsUrl(url)) {
      return { ok: false, status: 0, url };
    }

    let result: PolicyCurlRunResult;
    try {
      result = run(binary, [
        "-sSL",
        "--max-time",
        String(timeoutSeconds),
        "--proto",
        "=https",
        "-w",
        "\n%{http_code}",
        url,
      ]);
    } catch {
      return { ok: false, status: 0, url };
    }

    if (!result || result.error) {
      return { ok: false, status: 0, url };
    }
    const rawStdout =
      typeof result.stdout === "string" ? result.stdout : (result.stdout?.toString("utf8") ?? "");
    const lastNewline = rawStdout.lastIndexOf("\n");
    const statusLine = lastNewline >= 0 ? rawStdout.slice(lastNewline + 1).trim() : "";
    const httpStatus = /^\d{3}$/.test(statusLine) ? Number(statusLine) : undefined;
    const text = httpStatus === undefined ? rawStdout : rawStdout.slice(0, lastNewline);

    if (httpStatus !== undefined) {
      if (httpStatus >= 200 && httpStatus < 300) {
        return { ok: true, status: httpStatus, text, body: text, url };
      }
      return { ok: false, status: httpStatus, url };
    }
    if (result.status !== 0) {
      return { ok: false, status: typeof result.status === "number" ? result.status : 0, url };
    }
    return { ok: true, status: 200, text, body: text, url };
  };
}

function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/** Policy ports threaded into core install / lock / update / status. */
export type PolicyCliPorts = {
  fetchPolicyUrl?: PolicyFetcher;
  httpGet?: PolicyFetcher;
  providers?: string[];
  policyProviders?: string[];
  listGitRemotes?: (cwd?: string) => Array<{ name: string; url: string }>;
  remotes?: Array<{ name: string; url: string }>;
  adoHosts?: string[];
  fetchAncestor?: (
    ref: string,
    context: { leafHostClass: string; chain: string[] },
  ) => Record<string, unknown>;
  defaultFetchFailure?: "off" | "warn" | "block";
  implementationDefaultHost?: string;
};

export type ResolvePolicyPortsOptions = {
  /** Full escape (`--no-policy-all`): never install or pass a fetcher. */
  noPolicy?: boolean;
  /** Optional env overlay (install already carries one). */
  env?: Record<string, string | undefined>;
  /** Injected ports (tests) or pre-built fetcher. */
  policyPorts?: PolicyCliPorts;
};

/**
 * Full escape mirrors core `isPolicyDisabled`: `--no-policy-all`,
 * `BAPM_POLICY_DISABLE=1`, `APM_POLICY_DISABLE=1`.
 */
export function isPolicyFullEscape(options: ResolvePolicyPortsOptions = {}): boolean {
  if (options.noPolicy === true) return true;
  if (options.env?.BAPM_POLICY_DISABLE === "1") return true;
  if (options.env?.APM_POLICY_DISABLE === "1") return true;
  if (process.env.BAPM_POLICY_DISABLE === "1") return true;
  if (process.env.APM_POLICY_DISABLE === "1") return true;
  return false;
}

/**
 * Resolve ports to pass to core. Returns `{}` for a full escape so no network
 * port is threaded; otherwise ensures both `fetchPolicyUrl` and `httpGet` point
 * at the same fetcher. `--no-policy` (repo-only escape) keeps the fetcher.
 */
export function resolvePolicyPorts(options: ResolvePolicyPortsOptions = {}): PolicyCliPorts {
  if (isPolicyFullEscape(options)) return {};

  const ports = options.policyPorts ?? {};
  const fetcher = ports.fetchPolicyUrl ?? ports.httpGet ?? createPolicyFetcher();
  return { ...ports, fetchPolicyUrl: fetcher, httpGet: fetcher };
}
