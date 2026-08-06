/**
 * Shared Auth types — OpenAPM §10.3 credential host-class / resolve / git child env.
 */

export type ProviderHostClass = "github" | "ghe_cloud" | "ghes" | "gitlab" | "ado" | "generic";

export type RegistryAliasEntry = {
  url: string;
  aliases?: string[];
  insecure?: boolean;
  [key: string]: unknown;
};

export type RegistryAliasMap = Record<string, RegistryAliasEntry | string>;

export type ResolvedCredentials = {
  /** Secret — never log. */
  readonly token: string;
  /** Env / source id for diagnostics (sc-007). */
  readonly source: string;
  /** Cache / scope key including class + host + port (sc-013 e). */
  readonly cacheKey: string;
  /** Explicit port when present (narrows lookup within class). */
  readonly port?: number;
  /** PSL / alias credential host-class. */
  readonly credentialHostClass: string;
  /** True when a credential was selected for attach. */
  readonly attached: boolean;
};

export type ResolveCredentialsOptions = {
  host: string;
  url?: string;
  port?: number;
  env?: NodeJS.ProcessEnv;
  registries?: RegistryAliasMap;
  /** Named registry for BAPM_REGISTRY_<NAME>_TOKEN. */
  registryName?: string;
};

export type SameCredentialHostClassOptions = {
  registries?: RegistryAliasMap;
  /** Ignored — redirects never collapse classes (sc-005). */
  viaRedirect?: boolean;
};

export type BuildGitChildEnvOptions = {
  host: string;
  url: string;
  env?: NodeJS.ProcessEnv;
  registries?: RegistryAliasMap;
};

export type FetchWithRedirectAuthDropInit = RequestInit & {
  /** Max redirect hops (default 10). */
  maxRedirects?: number;
  /** Alias map for credential class compare. */
  registries?: RegistryAliasMap;
};
