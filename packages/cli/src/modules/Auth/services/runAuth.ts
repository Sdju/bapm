/**
 * `bapm auth` — report/resolve a credential for a git host (read-only).
 *
 * This is a thin CLI surface over core `Auth` (`resolveCredentialsForHost` /
 * `selectProviderClassForHost`). It never writes config and never prints a
 * token unless `--export` was explicitly requested.
 */
import {
  resolveCredentialsForHost,
  selectProviderClassForHost,
  type ProviderHostClass,
} from "@b-apm/core";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type AuthCliDeps = LifecycleCliDeps & {
  /** Environment override for tests / embedders. Defaults to `process.env` at run time. */
  env?: NodeJS.ProcessEnv;
  /** HTTP probe override. Defaults to the production fetch probe. */
  probe?: AuthTokenProbe;
};

export type AuthOptions = {
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  probe?: AuthTokenProbe;
};

export type ParsedAuthArgs = {
  host?: string;
  check: boolean;
  export: boolean;
  verbose: boolean;
  help?: boolean;
  error?: string;
};

export type AuthProbeRequest = {
  host: string;
  providerClass: ProviderHostClass;
  url: string;
  headers: Record<string, string>;
};

export type AuthProbeResult = { status: number };

/** Injectable REST probe. Tests pass a fake; production uses `fetch`. */
export type AuthTokenProbe = (request: AuthProbeRequest) => Promise<AuthProbeResult>;

export type AuthCheckVerdict = "ok" | "rejected" | "indeterminate";

const GITHUB_CLASSES: ReadonlySet<ProviderHostClass> = new Set(["github", "ghe_cloud", "ghes"]);

const EXPORT_ENV: Record<ProviderHostClass, string | undefined> = {
  github: "GITHUB_APM_PAT",
  ghe_cloud: "GITHUB_APM_PAT",
  ghes: "GITHUB_APM_PAT",
  gitlab: "GITLAB_APM_PAT",
  ado: "ADO_APM_PAT",
  generic: undefined,
};

const ENV_HINT: Record<ProviderHostClass, string> = {
  github: "GITHUB_APM_PAT (or GITHUB_TOKEN / GH_TOKEN)",
  ghe_cloud: "GITHUB_APM_PAT (or GITHUB_TOKEN / GH_TOKEN)",
  ghes: "GITHUB_APM_PAT (or GITHUB_TOKEN / GH_TOKEN)",
  gitlab: "GITLAB_APM_PAT (or GITLAB_TOKEN)",
  ado: "ADO_APM_PAT",
  generic: "GITHUB_APM_PAT / GITLAB_APM_PAT / ADO_APM_PAT",
};

const SCOPE_HINT: Record<ProviderHostClass, string> = {
  github: "repo",
  ghe_cloud: "repo",
  ghes: "repo",
  gitlab: "read_repository,read_api",
  ado: "Code (Read)",
  generic: "the host's API scope",
};

const HOST_ALIASES = new Map<string, string>([
  ["github", "github.com"],
  ["gh", "github.com"],
  ["gitlab", "gitlab.com"],
  ["azure", "dev.azure.com"],
  ["ado", "dev.azure.com"],
]);

export function formatAuthHelp(deps: AuthCliDeps): string {
  return `${deps.name} auth — Report a credential for a git host (read-only)

Usage:
  bapm auth <host> [--check] [--export] [-v]

Hosts:
  github, github.com         GitHub.com
  ghes                       GitHub Enterprise Server from GITHUB_HOST
  gitlab, gitlab.com         GitLab.com
  azure, ado, dev.azure.com  Azure DevOps
  <fqdn>                     Classified by GITHUB_HOST / GITLAB_HOST / ADO_HOST

Options:
  --check       Validate the token against the host REST API (one network call)
  --export      Print only \`export VAR='token'\` on stdout for eval
  -v, --verbose Show host/credential class details (never the token)
  -h, --help    Show this help

Exit codes:
  0  A credential is available (and --check either validated it or could not
     disprove it)
  1  No usable credential, unsupported/malformed host, or --check was rejected

Notes:
  Reads environment variables only (via core Auth): GITHUB_TOKEN / GH_TOKEN /
  GITHUB_APM_PAT, GITLAB_APM_PAT / GITLAB_TOKEN, ADO_APM_PAT. Never writes
  ~/.bapm/config.json and never prompts. With --export, stdout carries only the
  export line; all narration goes to stderr.
`;
}

export function parseAuthArgs(argv: string[]): ParsedAuthArgs {
  let check = false;
  let exportLine = false;
  let verbose = false;
  const positionals: string[] = [];

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") return { check, export: exportLine, verbose, help: true };
    if (arg === "--check") {
      check = true;
      continue;
    }
    if (arg === "--export") {
      exportLine = true;
      continue;
    }
    if (arg === "--verbose" || arg === "-v") {
      verbose = true;
      continue;
    }
    if (arg.startsWith("-")) {
      return { check, export: exportLine, verbose, error: `Unknown auth flag: ${arg}` };
    }
    positionals.push(arg);
  }

  if (positionals.length === 0) {
    return { check, export: exportLine, verbose, error: "Usage: bapm auth <host>" };
  }
  if (positionals.length > 1) {
    return {
      check,
      export: exportLine,
      verbose,
      error: `Expected one host, got: ${positionals.join(" ")}`,
    };
  }
  return { check, export: exportLine, verbose, host: positionals[0] };
}

function isBareHostname(value: string): boolean {
  if (!value || value.length > 253) return false;
  if (/[/\\\s@?#]/.test(value)) return false;
  if (value.includes("://") || value.includes(":")) return false;
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/i.test(
    value,
  );
}

type ResolvedHost = { host: string; providerClass: ProviderHostClass } | { error: string };

function classifyHost(host: string, env: NodeJS.ProcessEnv): ResolvedHost {
  try {
    return { host, providerClass: selectProviderClassForHost(host, env) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function resolveHost(raw: string, env: NodeJS.ProcessEnv): ResolvedHost {
  const input = raw.trim().toLowerCase();
  if (!input) return { error: "Expected a host name like 'github.com'." };

  if (input === "ghes") {
    const configured = (env.GITHUB_HOST ?? "").trim().toLowerCase();
    if (!configured) {
      return {
        error:
          "Host 'ghes' needs GITHUB_HOST=<your.enterprise.host>. " +
          "Set it and re-run (for example: GITHUB_HOST=ghe.corp.example bapm auth ghes).",
      };
    }
    if (!isBareHostname(configured)) {
      return { error: `GITHUB_HOST='${configured}' is not a bare host name.` };
    }
    return classifyHost(configured, env);
  }

  const host = HOST_ALIASES.get(input) ?? input;
  if (!isBareHostname(host)) {
    return {
      error: `Expected a bare host name like 'github.com', got '${raw}'.`,
    };
  }
  return classifyHost(host, env);
}

function unsupportedHostMessage(host: string, providerClass: ProviderHostClass): string {
  return (
    `No token flow for '${host}' (host class '${providerClass}').\n` +
    `    If this is a self-managed GitHub Enterprise Server, set GITHUB_HOST=${host} and re-run.\n` +
    `    If it is a self-managed GitLab, set GITLAB_HOST=${host} (or add it to APM_GITLAB_HOSTS) and re-run.\n` +
    `    If it is Azure DevOps, set ADO_HOST=${host} (or add it to APM_ADO_HOSTS) and re-run.\n` +
    `    bapm auth only resolves provider hosts; use 'bapm doctor' for generic hosts.`
  );
}

function trimBase(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "bapm-cli",
  };
}

function adoHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Basic ${Buffer.from(`:${token}`, "utf8").toString("base64")}`,
    "User-Agent": "bapm-cli",
  };
}

export function authCheckEndpoint(
  host: string,
  providerClass: ProviderHostClass,
  token: string,
  env: NodeJS.ProcessEnv,
): AuthProbeRequest | null {
  const configuredGithubApi = env.GITHUB_API_URL ? trimBase(env.GITHUB_API_URL) : "";
  switch (providerClass) {
    case "github":
      return {
        host,
        providerClass,
        url: `${configuredGithubApi || "https://api.github.com"}/user`,
        headers: githubHeaders(token),
      };
    case "ghe_cloud": {
      const base = configuredGithubApi || `https://api.${host}`;
      return { host, providerClass, url: `${base}/user`, headers: githubHeaders(token) };
    }
    case "ghes": {
      const base = configuredGithubApi || `https://${host}/api/v3`;
      return { host, providerClass, url: `${base}/user`, headers: githubHeaders(token) };
    }
    case "gitlab":
      return {
        host,
        providerClass,
        url: `https://${host}/api/v4/user`,
        headers: { "PRIVATE-TOKEN": token, "User-Agent": "bapm-cli" },
      };
    case "ado": {
      const configuredAdoApi = env.ADO_API_URL ? trimBase(env.ADO_API_URL) : "";
      const base =
        configuredAdoApi ||
        (host === "dev.azure.com" || host.endsWith(".visualstudio.com")
          ? "https://app.vssps.visualstudio.com"
          : `https://${host}`);
      return {
        host,
        providerClass,
        url: `${base}/_apis/profile/profiles/me?api-version=7.0`,
        headers: adoHeaders(token),
      };
    }
    default:
      return null;
  }
}

function isGithubInstallationToken(token: string): boolean {
  return token.startsWith("ghs_");
}

export function classifyAuthProbeStatus(
  status: number,
  providerClass: ProviderHostClass,
  token: string,
): AuthCheckVerdict {
  if (status >= 200 && status < 300) return "ok";
  if (status >= 300 && status < 400) return "indeterminate";
  if (status === 403 && GITHUB_CLASSES.has(providerClass) && isGithubInstallationToken(token)) {
    return "indeterminate";
  }
  if (status === 401 || status === 403) return "rejected";
  return "indeterminate";
}

function unreachableDetail(
  status: number | undefined,
  providerClass: ProviderHostClass,
  token: string,
): string {
  if (status === undefined) return " (the API could not be reached)";
  if (status === 403 && GITHUB_CLASSES.has(providerClass) && isGithubInstallationToken(token)) {
    return " (HTTP 403 -- an app/installation token has no user context)";
  }
  return ` (HTTP ${status} from the API)`;
}

/** Single-quote a value for POSIX shells; embedded quotes cannot break out. */
export function formatExportLine(variable: string, token: string): string {
  const safe = token.replace(/'/g, "'\\''");
  return `export ${variable}='${safe}'`;
}

const defaultProbe: AuthTokenProbe = async ({ url, headers }) => {
  const response = await fetch(url, {
    method: "GET",
    headers,
    // Never follow a redirect: a token must not move to another endpoint.
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  return { status: response.status };
};

export async function runAuthCli(
  deps: AuthCliDeps,
  options: AuthOptions = {},
): Promise<LifecycleResult> {
  const parsed = parseAuthArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatAuthHelp(deps));
    return { ok: true, exitCode: 0 };
  }
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    console.log(formatAuthHelp(deps));
    return { ok: false, exitCode: 1, message: parsed.error };
  }

  const env = options.env ?? deps.env ?? process.env;
  const probe = options.probe ?? deps.probe ?? defaultProbe;
  const resolved = resolveHost(parsed.host!, env);
  if ("error" in resolved) {
    console.error(`${deps.name}: ${resolved.error}`);
    return { ok: false, exitCode: 1, message: resolved.error };
  }

  const { host, providerClass } = resolved;
  const exportVar = EXPORT_ENV[providerClass];
  if (!exportVar) {
    const message = unsupportedHostMessage(host, providerClass);
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }

  // All narration goes to stderr under --export; stdout is reserved for the line.
  const narrate = (message: string): void => {
    if (parsed.export) console.error(message);
    else console.log(message);
  };

  const credentials = (() => {
    try {
      return { value: resolveCredentialsForHost({ host, env }) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  })();
  if ("error" in credentials) {
    console.error(`${deps.name}: ${credentials.error}`);
    return { ok: false, exitCode: 1, message: credentials.error };
  }
  const resolvedCredentials = credentials.value;
  if (!resolvedCredentials) {
    narrate(`${host}: no credential found.`);
    narrate(
      `  Set ${ENV_HINT[providerClass]} to a token with scopes '${SCOPE_HINT[providerClass]}'.`,
    );
    narrate(
      "  bapm reads tokens from environment variables only; it never writes ~/.bapm/config.json.",
    );
    return { ok: false, exitCode: 1, message: `no credential found for ${host}` };
  }

  if (parsed.verbose) {
    narrate(`  host-class: ${providerClass}`);
    narrate(`  credential-class: ${resolvedCredentials.credentialHostClass}`);
    narrate(`  source: ${resolvedCredentials.source}`);
  }

  if (parsed.check) {
    const endpoint = authCheckEndpoint(host, providerClass, resolvedCredentials.token, env);
    let verdict: AuthCheckVerdict = "indeterminate";
    let status: number | undefined;

    if (!endpoint) {
      narrate(`${host}: no REST endpoint is known for host class '${providerClass}'. Keeping it.`);
    } else {
      try {
        const result = await probe(endpoint);
        status = result.status;
        verdict = classifyAuthProbeStatus(result.status, providerClass, resolvedCredentials.token);
      } catch {
        verdict = "indeterminate";
      }
    }

    if (verdict === "ok") {
      narrate(`${host}: credential from ${resolvedCredentials.source} works.`);
    } else if (verdict === "indeterminate") {
      narrate(
        `${host}: could not validate the credential from ${resolvedCredentials.source}` +
          `${unreachableDetail(status, providerClass, resolvedCredentials.token)}. Keeping it.`,
      );
    } else {
      const detail = status ? ` (HTTP ${status})` : " (no response)";
      console.error(
        `${host}: the credential from ${resolvedCredentials.source} was rejected${detail}.`,
      );
      console.error(
        `  Create a replacement with scopes '${SCOPE_HINT[providerClass]}' and set ${ENV_HINT[providerClass]}.`,
      );
      return { ok: false, exitCode: 1, message: `credential rejected for ${host}` };
    }
  } else {
    narrate(`${host}: using credential from ${resolvedCredentials.source}.`);
    narrate("  Add --check to validate it against the API.");
  }

  if (parsed.export) {
    console.log(formatExportLine(exportVar, resolvedCredentials.token));
  }
  return { ok: true, exitCode: 0 };
}
