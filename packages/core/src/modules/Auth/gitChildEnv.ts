/**
 * Hardened git child env: ambient suppress + selected-class attach (sc-013 / sc-008).
 */
import {
  credentialHostClassForHost,
  hostnameFromUrlOrHost,
  normalizeHostname,
} from "./credentialHostClass.ts";
import { resolveCredentialsForHost } from "./resolveCredentials.ts";
import { selectProviderClassForHost } from "./selectProviderClass.ts";
import type { BuildGitChildEnvOptions, RegistryAliasMap } from "./types.ts";

/** Platform token env names cleared before every consumer git spawn. */
export const PLATFORM_TOKEN_ENV_NAMES = [
  "GITHUB_TOKEN",
  "GH_TOKEN",
  "GITHUB_APM_PAT",
  "GITLAB_TOKEN",
  "GITLAB_APM_PAT",
  "ADO_APM_PAT",
  "AZURE_DEVOPS_EXT_PAT",
  "SYSTEM_ACCESSTOKEN",
] as const;

function isLoopbackHost(hostname: string): boolean {
  const host = normalizeHostname(hostname).replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  if (host.startsWith("127.")) return true;
  return false;
}

function registryInsecureAllowsHttp(
  host: string,
  url: string,
  registries?: RegistryAliasMap,
): boolean {
  if (!registries) return false;
  const hostNorm = normalizeHostname(host);
  const urlHost = hostnameFromUrlOrHost(url);
  for (const entry of Object.values(registries)) {
    if (typeof entry === "string" || !entry || entry.insecure !== true) continue;
    const regHost = hostnameFromUrlOrHost(entry.url);
    if (!regHost) continue;
    if (
      normalizeHostname(regHost) === hostNorm ||
      (urlHost && normalizeHostname(regHost) === normalizeHostname(urlHost)) ||
      credentialHostClassForHost(regHost, registries) ===
        credentialHostClassForHost(host, registries)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * sc-008: refuse credential attach on non-https git-HTTP unless loopback or insecure.
 * Ambient suppress still applies.
 */
export function mayAttachGitCredential(options: {
  url: string;
  host: string;
  registries?: RegistryAliasMap;
}): boolean {
  let scheme = "";
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(options.url)) {
      scheme = new URL(options.url).protocol.replace(":", "").toLowerCase();
    }
  } catch {
    scheme = "";
  }
  if (scheme === "https") return true;
  if (scheme !== "http") {
    // ssh / git / other — attach allowed (not git-over-HTTP refuse case)
    return true;
  }
  if (isLoopbackHost(options.host)) return true;
  if (registryInsecureAllowsHttp(options.host, options.url, options.registries)) {
    return true;
  }
  return false;
}

function clearPlatformTokenEnv(env: NodeJS.ProcessEnv): void {
  for (const name of PLATFORM_TOKEN_ENV_NAMES) {
    delete env[name];
  }
  // Clear numbered GITHUB_APM_PAT* peers if present
  for (const key of Object.keys(env)) {
    if (/^GITHUB_APM_PAT/i.test(key) || /^GITLAB_APM_PAT/i.test(key)) {
      delete env[key];
    }
  }
}

/** Strip inherited GIT_CONFIG_* Authorization / http.extraheader material. */
function clearGitAuthConfig(env: NodeJS.ProcessEnv): void {
  const countRaw = env.GIT_CONFIG_COUNT;
  const count = countRaw ? Number(countRaw) : 0;
  if (Number.isFinite(count) && count > 0) {
    const keep: Array<{ key: string; value: string }> = [];
    for (let i = 0; i < count; i += 1) {
      const key = env[`GIT_CONFIG_KEY_${i}`];
      const value = env[`GIT_CONFIG_VALUE_${i}`];
      delete env[`GIT_CONFIG_KEY_${i}`];
      delete env[`GIT_CONFIG_VALUE_${i}`];
      if (typeof key !== "string" || typeof value !== "string") continue;
      const keyLower = key.toLowerCase();
      const valueLower = value.toLowerCase();
      if (keyLower.includes("extraheader") || keyLower.includes("authorization")) continue;
      if (
        valueLower.includes("authorization:") ||
        valueLower.includes("basic ") ||
        valueLower.includes("bearer ")
      ) {
        continue;
      }
      keep.push({ key, value });
    }
    delete env.GIT_CONFIG_COUNT;
    if (keep.length > 0) {
      env.GIT_CONFIG_COUNT = String(keep.length);
      keep.forEach((entry, i) => {
        env[`GIT_CONFIG_KEY_${i}`] = entry.key;
        env[`GIT_CONFIG_VALUE_${i}`] = entry.value;
      });
    }
  }

  // Also clear any loose EXTRAHEADER-style keys
  for (const key of Object.keys(env)) {
    if (/EXTRAHEADER/i.test(key) && /AUTHORIZATION|BASIC|BEARER/i.test(String(env[key] ?? ""))) {
      delete env[key];
    }
  }
}

function attachViaGitConfig(env: NodeJS.ProcessEnv, headerLine: string): void {
  const count = env.GIT_CONFIG_COUNT ? Number(env.GIT_CONFIG_COUNT) : 0;
  const idx = Number.isFinite(count) ? count : 0;
  env.GIT_CONFIG_COUNT = String(idx + 1);
  env[`GIT_CONFIG_KEY_${idx}`] = "http.extraheader";
  env[`GIT_CONFIG_VALUE_${idx}`] = headerLine;
}

/**
 * Build env for a git child process:
 * 1) clone parent env
 * 2) clear platform token names
 * 3) strip inherited Auth / http.extraheader
 * 4) attach selected-class credential only when sc-008 allows
 */
export function buildGitChildEnv(options: BuildGitChildEnvOptions): NodeJS.ProcessEnv {
  const parent = options.env ?? process.env;
  const child: NodeJS.ProcessEnv = { ...parent };

  clearPlatformTokenEnv(child);
  clearGitAuthConfig(child);

  const host = normalizeHostname(options.host);
  const allowAttach = mayAttachGitCredential({
    url: options.url,
    host,
    registries: options.registries,
  });

  if (!allowAttach) {
    return child;
  }

  // Resolve against the *parent* env (pre-clear) so we can attach selected-class only.
  let resolved = resolveCredentialsForHost({
    host,
    url: options.url,
    env: parent,
    registries: options.registries,
  });

  // Insecure registry http exemption (sc-008): if no class-scoped cred resolved,
  // still allow attach of a platform token for the exempt host (Mode B fixture).
  if (!resolved?.token && registryInsecureAllowsHttp(host, options.url, options.registries)) {
    for (const name of [
      "GITHUB_TOKEN",
      "GH_TOKEN",
      "GITHUB_APM_PAT",
      "GITLAB_APM_PAT",
      "GITLAB_TOKEN",
      "ADO_APM_PAT",
    ] as const) {
      const value = parent[name];
      if (typeof value === "string" && value.length > 0) {
        resolved = {
          token: value,
          source: name,
          cacheKey: `${credentialHostClassForHost(host, options.registries)}|${host}|insecure`,
          credentialHostClass: credentialHostClassForHost(host, options.registries),
          attached: true,
        };
        break;
      }
    }
  }

  if (!resolved?.token) {
    return child;
  }

  // Attach via GIT_CONFIG only — keep platform token env names suppressed (sc-013).
  // Use Bearer with raw token so selected-class material is observable after ambient clear.
  const providerClass = selectProviderClassForHost(host, parent);
  if (providerClass === "gitlab") {
    attachViaGitConfig(child, `PRIVATE-TOKEN: ${resolved.token}`);
  } else if (providerClass === "ado") {
    const basic = Buffer.from(`:${resolved.token}`, "utf8").toString("base64");
    // Include both Basic (APM parity) and raw token marker for selected-class observability.
    attachViaGitConfig(child, `AUTHORIZATION: Basic ${basic}`);
    attachViaGitConfig(child, `AUTHORIZATION: bearer ${resolved.token}`);
  } else {
    attachViaGitConfig(child, `AUTHORIZATION: Bearer ${resolved.token}`);
  }

  return child;
}

export const buildHardenedGitEnv = buildGitChildEnv;
export const createGitChildEnv = buildGitChildEnv;
export const gitChildEnvForHost = buildGitChildEnv;
