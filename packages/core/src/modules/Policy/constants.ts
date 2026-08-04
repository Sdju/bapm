/** Local dual-read policy filenames (discovery only; schema identical). */
export const APM_POLICY_FILE = "apm-policy.yml";
export const BAPM_POLICY_FILE = "bapm-policy.yml";

/**
 * Ordered discovery provider ids (pl-011).
 * Default: local dual-read first, then minimal remote `github-owner-dotgithub` (design D2).
 */
export const POLICY_PROVIDER_LOCAL = "local" as const;
export const POLICY_PROVIDER_GITHUB_OWNER_DOTGITHUB = "github-owner-dotgithub" as const;

export type DefaultPolicyProviderId =
  | typeof POLICY_PROVIDER_LOCAL
  | typeof POLICY_PROVIDER_GITHUB_OWNER_DOTGITHUB;

/**
 * Ordered discovery providers (pl-001/011).
 * Local dual-read first; remote github-owner-dotgithub when local is absent.
 */
export const DEFAULT_POLICY_PROVIDERS = [
  POLICY_PROVIDER_LOCAL,
  POLICY_PROVIDER_GITHUB_OWNER_DOTGITHUB,
] as const satisfies readonly DefaultPolicyProviderId[];

/** Alias export names accepted by acceptance helpers. */
export const POLICY_DISCOVERY_PROVIDERS = DEFAULT_POLICY_PROVIDERS;
export const defaultPolicyProviders = DEFAULT_POLICY_PROVIDERS;
