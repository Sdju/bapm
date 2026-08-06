/**
 * Resolve credentials per host / credential class (sc-003 / sc-013 e).
 * Never forwards class A credentials to class B requests.
 * Diagnostics expose source id only (sc-007).
 */
import {
  credentialHostClassForHost,
  hostnameFromUrlOrHost,
  normalizeHostname,
} from "./credentialHostClass.ts";
import { selectProviderClassForHost } from "./selectProviderClass.ts";
import type {
  ProviderHostClass,
  RegistryAliasMap,
  ResolveCredentialsOptions,
  ResolvedCredentials,
} from "./types.ts";

const GITHUB_ENV = ["GITHUB_TOKEN", "GH_TOKEN", "GITHUB_APM_PAT"] as const;
const GITLAB_ENV = ["GITLAB_APM_PAT", "GITLAB_TOKEN"] as const;
const ADO_ENV = ["ADO_APM_PAT"] as const;

function firstEnv(
  env: NodeJS.ProcessEnv,
  names: readonly string[],
): { token: string; source: string } | null {
  for (const name of names) {
    const value = env[name];
    if (typeof value === "string" && value.length > 0) {
      return { token: value, source: name };
    }
  }
  return null;
}

function resolveProviderEnv(
  cls: ProviderHostClass,
  env: NodeJS.ProcessEnv,
): { token: string; source: string } | null {
  switch (cls) {
    case "github":
    case "ghe_cloud":
    case "ghes":
      return firstEnv(env, GITHUB_ENV);
    case "gitlab":
      return firstEnv(env, GITLAB_ENV);
    case "ado":
      return firstEnv(env, ADO_ENV);
    default:
      return null;
  }
}

function parsePortFromUrl(url: string | undefined): number | undefined {
  if (!url) return undefined;
  try {
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return undefined;
    const u = new URL(url);
    if (u.port) return Number(u.port);
    if (u.protocol === "https:") return 443;
    if (u.protocol === "http:") return 80;
  } catch {
    return undefined;
  }
  return undefined;
}

function defaultPortForScheme(url: string | undefined): number | undefined {
  if (!url) return undefined;
  try {
    if (/^https:/i.test(url)) return 443;
    if (/^http:/i.test(url)) return 80;
  } catch {
    /* ignore */
  }
  return undefined;
}

function effectivePort(options: ResolveCredentialsOptions): number | undefined {
  if (typeof options.port === "number" && Number.isFinite(options.port)) {
    return options.port;
  }
  return parsePortFromUrl(options.url);
}

function findMatchingRegistry(
  host: string,
  port: number | undefined,
  registries: RegistryAliasMap | undefined,
): { name: string; url: string } | null {
  if (!registries) return null;
  const hostNorm = normalizeHostname(host);
  const hostClass = credentialHostClassForHost(host, registries);

  for (const [name, entry] of Object.entries(registries)) {
    if (name === "default") continue;
    const url = typeof entry === "string" ? entry : entry?.url;
    if (typeof url !== "string" || !url) continue;
    const regHost = hostnameFromUrlOrHost(url);
    if (!regHost) continue;

    const sameClass =
      normalizeHostname(regHost) === hostNorm ||
      credentialHostClassForHost(regHost, registries) === hostClass;
    if (!sameClass) continue;

    const regPort = parsePortFromUrl(url) ?? defaultPortForScheme(url);
    if (port !== undefined && regPort !== undefined && port !== regPort) {
      continue;
    }
    return { name, url };
  }
  return null;
}

function resolveRegistryToken(
  options: ResolveCredentialsOptions,
  env: NodeJS.ProcessEnv,
): { token: string; source: string } | null {
  const name = options.registryName?.trim();
  if (name) {
    const key = `BAPM_REGISTRY_${name.replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase()}_TOKEN`;
    const named = env[key];
    if (typeof named === "string" && named.length > 0) return { token: named, source: key };
  }
  const matched = findMatchingRegistry(options.host, effectivePort(options), options.registries);
  if (matched) {
    const key = `BAPM_REGISTRY_${matched.name.replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase()}_TOKEN`;
    const named = env[key];
    if (typeof named === "string" && named.length > 0) return { token: named, source: key };
  }
  // Global registry token only when request host matches a declared registry class
  // OR when registries explicitly include this host.
  if (options.registries && Object.keys(options.registries).length > 0) {
    if (!matched) return null;
    const global = env.BAPM_REGISTRY_TOKEN;
    if (typeof global === "string" && global.length > 0) {
      return { token: global, source: "BAPM_REGISTRY_TOKEN" };
    }
    return null;
  }
  // No registries context: do not treat BAPM_REGISTRY_TOKEN as github/provider cred.
  return null;
}

function buildCacheKey(
  credentialHostClass: string,
  host: string,
  port: number | undefined,
): string {
  const h = normalizeHostname(host);
  if (port !== undefined) return `${credentialHostClass}|${h}|${port}`;
  return `${credentialHostClass}|${h}`;
}

/**
 * Resolve at most one credential for the host's selected class.
 * Provider env tokens are never returned for a distinct registry host class,
 * and registry tokens are never returned for github.com-class provider hosts.
 */
export function resolveCredentialsForHost(
  options: ResolveCredentialsOptions,
): ResolvedCredentials | null {
  const env = options.env ?? process.env;
  const host = normalizeHostname(options.host);
  if (!host) return null;

  const port = effectivePort(options);
  const credClass = credentialHostClassForHost(host, options.registries);
  const cacheKey = buildCacheKey(credClass, host, port);
  const providerClass = selectProviderClassForHost(host, env);

  // Registry-scoped path: when registries map is provided and host matches a registry.
  const registryCred = resolveRegistryToken(options, env);
  const isProviderHost = providerClass !== "generic";

  if (isProviderHost) {
    // Never forward registry tokens to provider hosts.
    const providerCred = resolveProviderEnv(providerClass, env);
    if (!providerCred) return null;
    return {
      token: providerCred.token,
      source: providerCred.source,
      cacheKey,
      port,
      credentialHostClass: credClass,
      attached: true,
    };
  }

  // Non-provider (registry / generic) hosts: only registry tokens, never GitHub/GitLab/ADO env.
  if (registryCred) {
    return {
      token: registryCred.token,
      source: registryCred.source,
      cacheKey,
      port,
      credentialHostClass: credClass,
      attached: true,
    };
  }

  // Global BAPM_REGISTRY_TOKEN when no registries map but caller asks for a registry-ish host
  // via registryName only — already handled. Without registries, refuse provider env bleed.
  return null;
}

export const resolveAuthCredentialsForHost = resolveCredentialsForHost;
export const resolveHostCredentials = resolveCredentialsForHost;

/** Auth header map for a resolved credential + provider class. */
export function authHeadersForResolved(
  resolved: ResolvedCredentials | null,
  providerClass: ProviderHostClass,
): Record<string, string> {
  if (!resolved?.token) return {};
  switch (providerClass) {
    case "github":
    case "ghe_cloud":
    case "ghes":
      return { Authorization: `Bearer ${resolved.token}` };
    case "gitlab":
      return { "PRIVATE-TOKEN": resolved.token };
    case "ado": {
      const basic = Buffer.from(`:${resolved.token}`, "utf8").toString("base64");
      return { Authorization: `Basic ${basic}` };
    }
    default:
      return { Authorization: `Bearer ${resolved.token}` };
  }
}
