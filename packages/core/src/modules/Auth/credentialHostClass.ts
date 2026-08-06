/**
 * PSL eTLD+1 credential host-class (OpenAPM sc-005).
 * Private suffixes (e.g. github.io) via tldts allowPrivateDomains.
 */
import { getDomain } from "tldts";
import type { RegistryAliasMap, SameCredentialHostClassOptions } from "./types.ts";

function normalizeHostname(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[|\]$/g, "");
}

/**
 * Credential host-class = Public Suffix List eTLD+1 (registrable domain).
 * Empty / invalid hostnames fall back to the normalized hostname string.
 */
export function credentialHostClassOf(hostname: string): string {
  const host = normalizeHostname(hostname);
  if (!host) return "";
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.startsWith("127.")) {
    return host;
  }
  const domain = getDomain(host, { allowPrivateDomains: true });
  return (domain ?? host).toLowerCase();
}

export const credentialHostClass = credentialHostClassOf;
export const authHostClassOf = credentialHostClassOf;
export const hostClassForCredentials = credentialHostClassOf;

function hostnameFromUrlOrHost(raw: string): string | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
      return new URL(s).hostname;
    }
    const hostPart = s.split("/")[0] ?? s;
    if (hostPart.includes("@")) {
      const afterAt = hostPart.split("@")[1] ?? "";
      return afterAt.split(":")[0] || afterAt;
    }
    if (hostPart.includes(":")) {
      const [h] = hostPart.split(":");
      if (h) return h;
    }
    return hostPart;
  } catch {
    return undefined;
  }
}

/** Extract hostname from a registry alias entry string (bare host or URL). */
export function hostnameFromAlias(entry: string): string | undefined {
  const h = hostnameFromUrlOrHost(entry);
  return h ? normalizeHostname(h) : undefined;
}

/**
 * Build union: each aliases[] hostname joins the same credential class as the
 * registry entry's `url` hostname.
 */
export function buildAliasCredentialClassMap(registries?: RegistryAliasMap): Map<string, string> {
  const map = new Map<string, string>();
  if (!registries) return map;

  for (const entry of Object.values(registries)) {
    const url = typeof entry === "string" ? entry : entry?.url;
    if (typeof url !== "string" || !url) continue;
    const urlHost = hostnameFromUrlOrHost(url);
    if (!urlHost) continue;
    const urlClass = credentialHostClassOf(urlHost);

    // Registry url host maps to its own class (identity).
    map.set(normalizeHostname(urlHost), urlClass);

    const aliases = typeof entry === "object" && entry ? entry.aliases : undefined;
    if (!Array.isArray(aliases)) continue;
    for (const alias of aliases) {
      if (typeof alias !== "string") continue;
      const aliasHost = hostnameFromAlias(alias);
      if (!aliasHost) continue;
      // Alias joins the registry url's credential class.
      map.set(aliasHost, urlClass);
    }
  }
  return map;
}

/**
 * Effective credential class for a hostname, applying registries.*.aliases union.
 */
export function credentialHostClassForHost(
  hostname: string,
  registries?: RegistryAliasMap,
): string {
  const host = normalizeHostname(hostname);
  const aliasMap = buildAliasCredentialClassMap(registries);
  const aliased = aliasMap.get(host);
  if (aliased) return aliased;
  return credentialHostClassOf(host);
}

/**
 * Two hostnames share a credential class iff same PSL eTLD+1 or alias union.
 * Redirect / CNAME / SAN observation MUST NOT collapse classes.
 */
export function sameCredentialHostClass(
  a: string,
  b: string,
  options?: SameCredentialHostClassOptions,
): boolean {
  // viaRedirect intentionally ignored — never collapses classes.
  void options?.viaRedirect;
  const left = credentialHostClassForHost(a, options?.registries);
  const right = credentialHostClassForHost(b, options?.registries);
  if (!left || !right) return false;
  return left === right;
}

export const credentialHostClassesEqual = sameCredentialHostClass;
export const hostsShareCredentialClass = sameCredentialHostClass;

export { normalizeHostname, hostnameFromUrlOrHost };
