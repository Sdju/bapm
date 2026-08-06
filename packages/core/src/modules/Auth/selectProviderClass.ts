/**
 * Operator / provider host-class selection with overlap precedence (sc-013 a/b).
 * ADO_HOST / APM_ADO_HOSTS wins over GITHUB_HOST on the same FQDN;
 * GHES ∩ GitLab allowlist fail-closed.
 */
import type { ProviderHostClass } from "./types.ts";

function collectHosts(value: string | undefined): Set<string> {
  const set = new Set<string>();
  if (!value) return set;
  for (const part of value.split(/[,;\s]+/)) {
    const h = part.toLowerCase().trim();
    if (h) set.add(h);
  }
  return set;
}

export function collectGitlabHosts(env: NodeJS.ProcessEnv): Set<string> {
  const set = collectHosts(env.GITLAB_HOST);
  for (const h of collectHosts(env.APM_GITLAB_HOSTS)) set.add(h);
  return set;
}

export function collectAdoHosts(env: NodeJS.ProcessEnv): Set<string> {
  const set = collectHosts(env.ADO_HOST);
  for (const h of collectHosts(env.APM_ADO_HOSTS)) set.add(h);
  return set;
}

/**
 * Select exactly one provider class for a hostname.
 * Precedence: ado allowlist → (GHES∩GitLab fail) → github.com / ghe.com /
 * GITHUB_HOST → gitlab allowlist / gitlab.com → ado cloud → generic.
 */
export function selectProviderClassForHost(
  host: string,
  env: NodeJS.ProcessEnv = process.env,
): ProviderHostClass {
  const h = host.toLowerCase().trim();
  if (!h) return "generic";

  const githubHost = (env.GITHUB_HOST ?? "").toLowerCase().trim();
  const gitlabHosts = collectGitlabHosts(env);
  const adoHosts = collectAdoHosts(env);
  const isGhes = Boolean(githubHost && h === githubHost);
  const isGitlabAllowlisted = gitlabHosts.has(h);
  const isAdoAllowlisted = adoHosts.has(h);

  // sc-013: ADO wins over GITHUB_HOST on the same FQDN.
  if (isAdoAllowlisted) return "ado";

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

export const effectiveProviderClassForHost = selectProviderClassForHost;
export const classifyProviderHostClass = selectProviderClassForHost;
/** Marketplace-compatible alias (acceptance soft-resolve). */
export const classifyMarketplaceHost = selectProviderClassForHost;
