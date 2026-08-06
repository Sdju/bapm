/**
 * Host-class pin (pl-004 / OpenAPM §10.3): PSL eTLD+1 via shared Auth classifier,
 * or synthetic `local` for filesystem-only leaves.
 */
import { credentialHostClassOf } from "@/modules/Auth";

export type HostClassInput =
  | string
  | {
      url?: string;
      host?: string;
      hostname?: string;
    };

/** Implementation-default host for `github-owner-dotgithub` (design D1). */
export const IMPLEMENTATION_DEFAULT_HOST = "github.com";

/**
 * Derive host class from a URL / hostname using PSL eTLD+1 (unified with Auth).
 */
export function hostClassOf(input: HostClassInput): string {
  const host = extractHostname(input);
  if (!host) return "local";
  const lower = host.toLowerCase().replace(/\.$/, "");
  if (!lower || lower === "localhost" || lower === "127.0.0.1" || lower === "::1") {
    return "local";
  }
  return credentialHostClassOf(lower);
}

/** Alias accepted by acceptance helpers. */
export const policyHostClass = hostClassOf;
export const hostClassForPolicy = hostClassOf;
export const resolveHostClass = hostClassOf;

function extractHostname(input: HostClassInput): string | undefined {
  if (typeof input === "string") {
    return hostnameFromString(input);
  }
  if (input.host) return hostnameFromString(input.host);
  if (input.hostname) return hostnameFromString(input.hostname);
  if (input.url) return hostnameFromString(input.url);
  return undefined;
}

function hostnameFromString(raw: string): string | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
      return new URL(s).hostname;
    }
    // owner/repo — not a host
    if (/^[^/]+\/[^/]+$/.test(s) && !s.includes(".")) {
      return undefined;
    }
    // bare host or host/path
    const hostPart = s.split("/")[0] ?? s;
    if (hostPart.includes("@")) {
      // git@github.com:owner/repo
      const afterAt = hostPart.split("@")[1] ?? "";
      return afterAt.split(":")[0] || afterAt;
    }
    if (hostPart.includes(":")) {
      // host:port or scp-like github.com:owner
      const [h] = hostPart.split(":");
      if (h?.includes(".")) return h;
    }
    if (hostPart.includes(".")) return hostPart;
    return undefined;
  } catch {
    return undefined;
  }
}
