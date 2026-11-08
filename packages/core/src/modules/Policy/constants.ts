/** Local dual-read policy filenames (discovery only; schema identical). */
export const APM_POLICY_FILE = "apm-policy.yml";
export const BAPM_POLICY_FILE = "bapm-policy.yml";

/**
 * Ordered GitHub org policy repository candidates (APM 0.35 parity).
 * First repository with a policy file wins.
 */
export const POLICY_REPO_CANDIDATES_GITHUB = [
  ".github-private",
  ".github",
  ".apm",
  "_apm",
] as const;

/**
 * Ordered discovery provider ids (pl-011).
 * Default: local dual-read first, then remote GitHub owner-org and Azure DevOps.
 */
export const POLICY_PROVIDER_LOCAL = "local" as const;
export const POLICY_PROVIDER_GITHUB_OWNER_DOTGITHUB = "github-owner-dotgithub" as const;
export const POLICY_PROVIDER_AZURE_DEVOPS_ORG_POLICY = "azure-devops-org-policy" as const;

/** Alias provider ids accepted for Azure DevOps discovery. */
export const POLICY_PROVIDER_AZURE_DEVOPS_ORG = POLICY_PROVIDER_AZURE_DEVOPS_ORG_POLICY;
export const POLICY_PROVIDER_ADO_ORG_POLICY = POLICY_PROVIDER_AZURE_DEVOPS_ORG_POLICY;

export type DefaultPolicyProviderId =
  | typeof POLICY_PROVIDER_LOCAL
  | typeof POLICY_PROVIDER_GITHUB_OWNER_DOTGITHUB
  | typeof POLICY_PROVIDER_AZURE_DEVOPS_ORG_POLICY;

/**
 * Ordered discovery providers (pl-001/011).
 * Local dual-read first; remote providers run only when local is absent.
 */
export const DEFAULT_POLICY_PROVIDERS = [
  POLICY_PROVIDER_LOCAL,
  POLICY_PROVIDER_GITHUB_OWNER_DOTGITHUB,
  POLICY_PROVIDER_AZURE_DEVOPS_ORG_POLICY,
] as const satisfies readonly DefaultPolicyProviderId[];

/** Alias export names accepted by acceptance helpers. */
export const POLICY_DISCOVERY_PROVIDERS = DEFAULT_POLICY_PROVIDERS;
export const defaultPolicyProviders = DEFAULT_POLICY_PROVIDERS;
