/** Local dual-read policy filenames (discovery only; schema identical). */
export const APM_POLICY_FILE = "apm-policy.yml";
export const BAPM_POLICY_FILE = "bapm-policy.yml";

/**
 * Ordered discovery providers for M8 (pl-001/011 posture).
 * Local dual-read only; remote `github-owner-dotgithub` deferred N/A.
 */
export const DEFAULT_POLICY_PROVIDERS = ["local"] as const;

/** Alias export names accepted by acceptance helpers. */
export const POLICY_DISCOVERY_PROVIDERS = DEFAULT_POLICY_PROVIDERS;
export const defaultPolicyProviders = DEFAULT_POLICY_PROVIDERS;
