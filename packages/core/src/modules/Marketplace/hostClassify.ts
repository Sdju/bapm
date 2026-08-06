/**
 * Marketplace host classification — delegates operator overlap to Auth (sc-013).
 */
import {
  collectGitlabHosts,
  selectProviderClassForHost,
  type ProviderHostClass,
} from "@/modules/Auth";
import type { MarketplaceSourceKind } from "./types.ts";

/** Fine-grained marketplace host class for auth/API base selection. */
export type MarketplaceHostClass = ProviderHostClass;

/**
 * Classify a marketplace hostname using env allowlists.
 * Throws on GHES↔GitLab overlap; ADO_HOST wins over GITHUB_HOST on same FQDN.
 */
export function classifyMarketplaceHost(
  host: string,
  env: NodeJS.ProcessEnv = process.env,
): MarketplaceHostClass {
  return selectProviderClassForHost(host, env);
}

/** Map fine-grained class → MarketplaceSource.kind. */
export function marketplaceKindFromHostClass(cls: MarketplaceHostClass): MarketplaceSourceKind {
  switch (cls) {
    case "github":
    case "ghe_cloud":
    case "ghes":
      return "github";
    case "gitlab":
      return "gitlab";
    case "ado":
      return "ado";
    default:
      return "git";
  }
}

/** Convenience: host → source kind (throws on overlap). */
export function classifyMarketplaceHostKind(
  host: string,
  env: NodeJS.ProcessEnv = process.env,
): MarketplaceSourceKind {
  return marketplaceKindFromHostClass(classifyMarketplaceHost(host, env));
}

/** GitHub Contents API base for a github-class host. */
export function githubApiBaseForHost(host: string, env: NodeJS.ProcessEnv = process.env): string {
  const cls = classifyMarketplaceHost(host, env);
  if (cls === "github") return "https://api.github.com";
  if (cls === "ghe_cloud" || cls === "ghes") {
    return `https://${host.toLowerCase().trim()}/api/v3`;
  }
  const h = host.toLowerCase().trim();
  if (h === "github.com") return "https://api.github.com";
  return `https://${h}/api/v3`;
}

/** True when host is unlocked for marketplace fetch / authoring probe. */
export function isUnlockedMarketplaceHost(
  host: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return classifyMarketplaceHost(host, env) !== "generic";
}

export { collectGitlabHosts };
