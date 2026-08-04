/**
 * Host-class pin (pl-004 / OpenAPM §10.3 spirit): registrable domain (eTLD+1)
 * of the fetch host, or synthetic `local` for filesystem-only leaves.
 */

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
 * Derive host class from a URL / hostname.
 * Common public suffixes: last two labels (github.com, gitlab.com).
 * Multi-part suffixes like `github.io` / `co.uk` are treated as last two labels
 * for P4 pin tests (github.com ≠ gitlab.com).
 */
export function hostClassOf(input: HostClassInput): string {
  const host = extractHostname(input);
  if (!host) return "local";
  const lower = host.toLowerCase().replace(/\.$/, "");
  if (!lower || lower === "localhost" || lower === "127.0.0.1") return "local";
  const parts = lower.split(".").filter(Boolean);
  if (parts.length <= 1) return lower;
  // eTLD+1 approximation: last two labels
  return parts.slice(-2).join(".");
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
