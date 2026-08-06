/**
 * Redirect-safe Authed fetch (OpenAPM sc-003).
 * Manual redirect follow; drop Authorization when Location host class ≠ origin class.
 */
import { credentialHostClassForHost, hostnameFromUrlOrHost } from "./credentialHostClass.ts";
import type { FetchWithRedirectAuthDropInit, RegistryAliasMap } from "./types.ts";

const DEFAULT_MAX_REDIRECTS = 10;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function headersToRecord(headers: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    for (const pair of headers) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const k = pair[0];
      const v = pair[1];
      if (typeof k === "string" && typeof v === "string") out[k] = v;
    }
    return out;
  }
  if (typeof headers === "object") {
    for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
  }
  return out;
}

function stripCredentialHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    const lower = k.toLowerCase();
    if (lower === "authorization" || lower === "proxy-authorization" || lower === "private-token") {
      continue;
    }
    out[k] = v;
  }
  return out;
}

function resolveRedirectUrl(current: string, location: string): string {
  return new URL(location, current).href;
}

/**
 * Fetch with redirect: 'manual' hop budget; strip Auth on cross-class Location.
 * Same-class redirects MAY retain Authorization.
 */
export async function fetchWithRedirectAuthDrop(
  input: string | URL | Request,
  init?: FetchWithRedirectAuthDropInit,
): Promise<Response> {
  const maxRedirects = init?.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const registries: RegistryAliasMap | undefined = init?.registries;

  let url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

  let headers = headersToRecord(
    init?.headers ?? (input instanceof Request ? input.headers : undefined),
  );
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  let body = init?.body;
  const originHost = hostnameFromUrlOrHost(url) ?? "";
  const originClass = credentialHostClassForHost(originHost, registries);

  // Strip redirect from init so undici/node never auto-follows with Auth.
  const { maxRedirects: _mr, registries: _reg, redirect: _redir, ...rest } = init ?? {};
  void _mr;
  void _reg;
  void _redir;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const response = await fetch(url, {
      ...rest,
      method,
      headers,
      body: hop === 0 ? body : method === "GET" || method === "HEAD" ? undefined : body,
      redirect: "manual",
    });

    if (!REDIRECT_STATUSES.has(response.status)) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) return response;

    const nextUrl = resolveRedirectUrl(url, location);
    const nextHost = hostnameFromUrlOrHost(nextUrl) ?? "";
    const nextClass = credentialHostClassForHost(nextHost, registries);
    const prevClass = credentialHostClassForHost(hostnameFromUrlOrHost(url) ?? "", registries);

    // Drop origin-class Auth when destination class differs (sc-003).
    if (nextClass !== prevClass || nextClass !== originClass) {
      headers = stripCredentialHeaders(headers);
    }
    // Same class: MAY keep Authorization (retain headers).

    url = nextUrl;
    // 303 → GET; body dropped for GET/HEAD
    if (response.status === 303 || method === "GET" || method === "HEAD") {
      body = undefined;
    }
  }

  throw new Error(`Too many redirects (max ${maxRedirects}) while fetching ${url}`);
}

export const fetchRedirectAuthDrop = fetchWithRedirectAuthDrop;
export const redirectSafeFetch = fetchWithRedirectAuthDrop;
export const fetchWithCredentialHostClassRedirects = fetchWithRedirectAuthDrop;
