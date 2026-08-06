/**
 * Registry URL http gate helpers (OpenAPM §4.2.3 / sc-006).
 */

/** Loopback, localhost, ::1, and RFC1918 private hosts — http allowed without insecure. */
export function isExemptInsecureHost(hostname: string): boolean {
  const raw = hostname.trim().toLowerCase();
  if (!raw) return false;
  // URL.hostname for IPv6 is without brackets; tolerate brackets if present.
  const host = raw.replace(/^\[|\]$/g, "");

  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  if (host.startsWith("127.")) return true;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4) return false;
  const a = Number(ipv4[1]);
  const b = Number(ipv4[2]);
  const c = Number(ipv4[3]);
  const d = Number(ipv4[4]);
  if ([a, b, c, d].some((n) => n > 255)) return false;

  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  return false;
}
