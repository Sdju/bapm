/**
 * Marketplace host classification (thin; not full OpenAPM §10.3 AuthResolver).
 */
import type { MarketplaceSourceKind } from "./types.ts";

/** Fine-grained marketplace host class for auth/API base selection. */
export type MarketplaceHostClass = "github" | "ghe_cloud" | "ghes" | "gitlab" | "ado" | "generic";

function collectGitlabHosts(env: NodeJS.ProcessEnv): Set<string> {
  const set = new Set<string>();
  const single = (env.GITLAB_HOST ?? "").toLowerCase().trim();
  if (single) set.add(single);
  const multi = (env.APM_GITLAB_HOSTS ?? "")
    .split(/[,;\s]+/)
    .map((s) => s.toLowerCase().trim())
    .filter(Boolean);
  for (const h of multi) set.add(h);
  return set;
}

/**
 * Classify a marketplace hostname using env allowlists.
 * Throws on GHES↔GitLab overlap for the same hostname.
 */
export function classifyMarketplaceHost(
  host: string,
  env: NodeJS.ProcessEnv = process.env,
): MarketplaceHostClass {
  const h = host.toLowerCase().trim();
  if (!h) return "generic";

  const githubHost = (env.GITHUB_HOST ?? "").toLowerCase().trim();
  const gitlabHosts = collectGitlabHosts(env);
  const isGhes = Boolean(githubHost && h === githubHost);
  const isGitlabAllowlisted = gitlabHosts.has(h);

  if (isGhes && isGitlabAllowlisted) {
    throw new Error(
      `Host '${h}' is ambiguous: GITHUB_HOST and GitLab allowlist overlap / conflict`,
    );
  }

  if (h === "github.com") return "github";
  if (h === "ghe.com" || h.endsWith(".ghe.com")) return "ghe_cloud";
  if (isGhes) return "ghes";
  if (h === "gitlab.com" || h.endsWith(".gitlab.com") || isGitlabAllowlisted) {
    return "gitlab";
  }
  if (h === "dev.azure.com" || h.endsWith(".visualstudio.com")) return "ado";
  return "generic";
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
  // Fallback for callers that already know it's github-kind enterprise
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
