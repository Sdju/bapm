/**
 * Auth / credential host-class helpers (promoted from sc-host-class acceptance).
 * Soft-resolve Auth / Registry / Manifest APIs from @bapm/core — missing exports = fail.
 */
import * as core from "@bapm/core";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const suiteDir = here;
export const coreRoot = resolve(here, "../../..");
export const repoRoot = resolve(coreRoot, "../..");

type AnyFn = (...args: never[]) => unknown;

export function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @bapm/core to export one of [${names.join(", ")}] (${label})`);
}

/** PSL eTLD+1 credential host-class classifier (sc-005). */
export function getCredentialHostClassOf(): (hostname: string) => string {
  return pickExport(
    ["credentialHostClassOf", "credentialHostClass", "authHostClassOf", "hostClassForCredentials"],
    "credential host-class classifier",
  ) as (hostname: string) => string;
}

/** Whether two hosts share a credential class given optional registry alias map. */
export function getSameCredentialHostClass(): (
  a: string,
  b: string,
  options?: Record<string, unknown>,
) => boolean {
  return pickExport(
    ["sameCredentialHostClass", "credentialHostClassesEqual", "hostsShareCredentialClass"],
    "credential host-class equality",
  ) as (a: string, b: string, options?: Record<string, unknown>) => boolean;
}

/** Shared resolve — never forwards class A creds to class B (sc-003). */
export function getResolveCredentialsForHost(): (options: Record<string, unknown>) => unknown {
  return pickExport(
    ["resolveCredentialsForHost", "resolveAuthCredentialsForHost", "resolveHostCredentials"],
    "resolve credentials per host class",
  ) as (options: Record<string, unknown>) => unknown;
}

/** Redirect-safe Authed fetch helper (sc-003). */
export function getFetchWithRedirectAuthDrop(): (
  input: string | URL | Request,
  init?: Record<string, unknown>,
) => Promise<Response> {
  return pickExport(
    [
      "fetchWithRedirectAuthDrop",
      "fetchRedirectAuthDrop",
      "redirectSafeFetch",
      "fetchWithCredentialHostClassRedirects",
    ],
    "redirect Auth drop fetch",
  ) as (input: string | URL | Request, init?: Record<string, unknown>) => Promise<Response>;
}

export function getCreateFetchTransport(): () => {
  fetch: (request: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: Uint8Array;
  }) => Promise<{ status: number; headers: Record<string, string>; body: Uint8Array }>;
} {
  return pickExport(["createFetchTransport"], "Registry createFetchTransport") as () => {
    fetch: (request: {
      method: string;
      url: string;
      headers?: Record<string, string>;
      body?: Uint8Array;
    }) => Promise<{ status: number; headers: Record<string, string>; body: Uint8Array }>;
  };
}

/** Git child env: ambient suppress + selected-class attach + sc-008 refuse. */
export function getBuildGitChildEnv(): (options: Record<string, unknown>) => NodeJS.ProcessEnv {
  return pickExport(
    ["buildGitChildEnv", "buildHardenedGitEnv", "createGitChildEnv", "gitChildEnvForHost"],
    "git ambient-suppress child env",
  ) as (options: Record<string, unknown>) => NodeJS.ProcessEnv;
}

/** Operator / provider class selection with overlap precedence (sc-013). */
export function getSelectProviderClassForHost(): (host: string, env?: NodeJS.ProcessEnv) => string {
  return pickExport(
    [
      "selectProviderClassForHost",
      "effectiveProviderClassForHost",
      "classifyProviderHostClass",
      "classifyMarketplaceHost",
    ],
    "provider class overlap selection",
  ) as (host: string, env?: NodeJS.ProcessEnv) => string;
}

export function getParseManifest(): (input: unknown) => unknown {
  return pickExport(
    ["parseManifest", "parseApmManifest", "loadManifestDocument"],
    "manifest parse",
  ) as (input: unknown) => unknown;
}

export function getHostClassOf(): (input: unknown) => unknown {
  return pickExport(
    ["hostClassOf", "policyHostClass", "hostClassForPolicy", "resolveHostClass"],
    "policy/credential hostClassOf",
  ) as (input: unknown) => unknown;
}

export function tokenPayload(resolved: unknown): {
  token?: string;
  source?: string;
  attached?: boolean;
} {
  if (resolved == null) return {};
  if (typeof resolved === "string") return { token: resolved };
  if (typeof resolved !== "object") return {};
  const o = resolved as Record<string, unknown>;
  const token =
    (typeof o.token === "string" && o.token) ||
    (typeof o.value === "string" && o.value) ||
    (typeof o.pat === "string" && o.pat) ||
    undefined;
  const source =
    (typeof o.source === "string" && o.source) ||
    (typeof o.sourceId === "string" && o.sourceId) ||
    (typeof o.env === "string" && o.env) ||
    undefined;
  const attached = typeof o.attached === "boolean" ? o.attached : undefined;
  return { token, source, attached };
}

export function hasUsableToken(resolved: unknown): boolean {
  const { token } = tokenPayload(resolved);
  return Boolean(token && token.length > 0);
}

/** Snapshot + restore selected env keys. */
export async function withEnv<T>(
  patch: Record<string, string | undefined>,
  fn: () => Promise<T> | T,
): Promise<T> {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(patch)) {
    prev[key] = process.env[key];
    const next = patch[key];
    if (next === undefined) delete process.env[key];
    else process.env[key] = next;
  }
  try {
    return await fn();
  } finally {
    for (const key of Object.keys(patch)) {
      const v = prev[key];
      if (v === undefined) delete process.env[key];
      else process.env[key] = v;
    }
  }
}

export { core };
