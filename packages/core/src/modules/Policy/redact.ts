/**
 * Redact credential-bearing URLs / refs before status display.
 * Drops userinfo and query string; also scrub plaintext secrets that survive path.resolve.
 */

const QUERY_SIG_RE = /([?&](?:sig|token|access_token|key|password|secret)=)[^&\s"']+/gi;

/**
 * Scrub a single source / extends ref for human + JSON report fields.
 */
export function redactPolicyRef(ref: string): string {
  if (!ref) return ref;
  let out = scrubUrlLike(ref);
  // user:pass@ or user:***@ → drop identity entirely
  out = out.replace(/\/\/[^/@\s]+:[^@/\s]*@/g, "//***@");
  out = out.replace(/\/\/[^/@\s]+@/g, "//***@");
  out = out.replace(QUERY_SIG_RE, "$1***");
  if (/s3cr3t|private-signature/i.test(out)) {
    out = out.replace(/s3cr3t/gi, "***").replace(/private-signature/gi, "***");
  }
  return out;
}

function scrubUrlLike(url: string): string {
  try {
    const parsed = new URL(url);
    const hasUserinfo = Boolean(parsed.username || parsed.password);
    if (!hasUserinfo && !parsed.search) return url;
    const host =
      parsed.port && parsed.port !== "" ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
    return `${parsed.protocol}//${host}${parsed.pathname}${parsed.hash}`;
  } catch {
    return url;
  }
}

/** Deep-redact string leaves in diagnostics / warning payloads. */
export function redactValue(value: unknown): unknown {
  if (typeof value === "string") return redactPolicyRef(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactValue(v);
    }
    return out;
  }
  return value;
}
