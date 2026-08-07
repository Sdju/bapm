/**
 * Thin env-scoped token resolve by marketplace host class.
 * Routes class selection through Auth; MUST NOT consult cross-class env names.
 */
import { selectProviderClassForHost, type ProviderHostClass } from "@/modules/Auth";
import type { MarketplaceHostClass } from "./hostClassify.ts";

export type ResolvedMarketplaceToken = {
  /** Secret value — never log. */
  readonly token: string;
  /** Env source id for diagnostics (e.g. GITHUB_TOKEN). */
  readonly source: string;
};

function firstEnv(
  env: NodeJS.ProcessEnv,
  names: readonly string[],
): ResolvedMarketplaceToken | null {
  for (const name of names) {
    const value = env[name];
    if (typeof value === "string" && value.length > 0) {
      return { token: value, source: name };
    }
  }
  return null;
}

const GITHUB_ENV = ["GITHUB_TOKEN", "GH_TOKEN", "GITHUB_APM_PAT"] as const;
const GITLAB_ENV = ["GITLAB_APM_PAT", "GITLAB_TOKEN"] as const;
const ADO_ENV = ["ADO_APM_PAT"] as const;

function resolveForClass(
  cls: MarketplaceHostClass,
  env: NodeJS.ProcessEnv,
): ResolvedMarketplaceToken | null {
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

/**
 * Resolve at most one env token for the host's class (or null).
 * Fail-closed cross-class: never returns another class's env value.
 */
export function resolveTokenForHost(
  host: string,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedMarketplaceToken | null {
  const cls = selectProviderClassForHost(host, env);
  return resolveForClass(cls, env);
}

/** Alias preferred by some soft-resolve helpers. */
export const resolveMarketplaceTokenForHost = resolveTokenForHost;
export const resolveAuthTokenForHost = resolveTokenForHost;

/** Auth headers for a given host class (empty when no token). */
export function authHeadersForHost(
  host: string,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const cls = selectProviderClassForHost(host, env);
  const resolved = resolveForClass(cls, env);
  if (!resolved) return {};

  switch (cls) {
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
      return {};
  }
}
